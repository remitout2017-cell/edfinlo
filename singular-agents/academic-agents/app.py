"""
Flask Production Server for Academic Records Processing
With OpenRouter Fallback and Process Pool Support
"""

import os
import sys
import json
import uuid
import time
import signal
import logging
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import redis
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Import the academic records processing module
try:
    from agent import process_academic_records_enhanced, GapDetector, Config
    print("✅ Agent module imported successfully")
except ImportError as e:
    print(f"❌ Failed to import agent module: {e}")
    print("⚠️ Make sure agent.py is in the same directory")
    sys.exit(1)

# =========================
# Configuration
# =========================
load_dotenv()

class ServerConfig:
    """Server configuration"""
    # Server settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5002"))
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    # Upload settings
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "./academic_uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", str(50 * 1024 * 1024)))  # 50MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
    
    # Processing settings
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", str(os.cpu_count() or 4)))
    JOB_TIMEOUT = int(os.getenv("JOB_TIMEOUT", "300"))  # 5 minutes
    
    # Redis settings (optional)
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))
    
    @classmethod
    def validate(cls):
        """Validate configuration"""
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('server.log'),
                logging.StreamHandler()
            ]
        )

# =========================
# Initialize
# =========================
ServerConfig.validate()
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = ServerConfig.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = ServerConfig.MAX_CONTENT_LENGTH
CORS(app)

# Initialize Redis (optional)
try:
    redis_client = redis.Redis(
        host=ServerConfig.REDIS_HOST,
        port=ServerConfig.REDIS_PORT,
        password=ServerConfig.REDIS_PASSWORD or None,
        db=ServerConfig.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    logger.info("Redis connected successfully")
except redis.ConnectionError:
    logger.warning("Redis not available, using in-memory job storage")
    redis_client = None

# Process pool for parallel processing
process_pool = ProcessPoolExecutor(max_workers=ServerConfig.MAX_WORKERS)
job_store = {}  # In-memory job store

# Cleanup job store periodically
def cleanup_job_store():
    """Clean up expired jobs"""
    current_time = time.time()
    expired_jobs = []
    for job_id, job_data in job_store.items():
        if job_data["expiry"] < current_time:
            expired_jobs.append(job_id)
    for job_id in expired_jobs:
        del job_store[job_id]
    if expired_jobs:
        logger.info(f"Cleaned up {len(expired_jobs)} expired jobs")

# Metrics
class Metrics:
    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.processing_time_total = 0
        self.jobs_processed = 0
        self.lock = threading.Lock()
    
    def record_request(self, success: bool, processing_time: float):
        with self.lock:
            self.requests_total += 1
            if success:
                self.requests_success += 1
            else:
                self.requests_failed += 1
            self.processing_time_total += processing_time
            self.jobs_processed += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            avg_time = (self.processing_time_total / self.jobs_processed 
                       if self.jobs_processed > 0 else 0)
            return {
                "requests_total": self.requests_total,
                "requests_success": self.requests_success,
                "requests_failed": self.requests_failed,
                "success_rate": (self.requests_success / self.requests_total 
                               if self.requests_total > 0 else 0),
                "avg_processing_time_seconds": avg_time,
                "jobs_processed": self.jobs_processed,
            }

metrics = Metrics()

# =========================
# Helper Functions
# =========================

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ServerConfig.ALLOWED_EXTENSIONS

def save_uploaded_file(file, job_id: str, file_type: str) -> Optional[str]:
    """Save uploaded file and return path"""
    if file and file.filename != '' and allowed_file(file.filename):
        filename = secure_filename(f"{job_id}_{file_type}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        logger.info(f"Saved file: {filename} to {filepath}")
        return filepath
    return None

def process_job_worker(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """Worker function for process pool"""
    import sys
    import os
    
    # Add current directory to Python path for worker processes
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    start_time = time.time()
    try:
        # Re-import in worker process
        from agent import process_academic_records_enhanced
        
        result = process_academic_records_enhanced(
            inputs=job_data.get("inputs", {}),
            use_groq_verifier=False,
            enable_gap_detection=True  # Always enable gap detection
        )
        
        processing_time = time.time() - start_time
        
        return {
            "status": "completed",
            "result": result,
            "processing_time": processing_time,
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        import traceback
        error_msg = str(e)
        logger.error(f"Job processing failed: {error_msg}")
        return {
            "status": "failed",
            "error": error_msg,
            "traceback": traceback.format_exc(),
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }

def store_job_result(job_id: str, result: Dict[str, Any]):
    """Store job result"""
    if redis_client:
        redis_client.setex(f"job:{job_id}", ServerConfig.JOB_TIMEOUT * 2, json.dumps(result))
    else:
        # Clean up old jobs first
        cleanup_job_store()
        job_store[job_id] = {"result": result, "expiry": time.time() + (ServerConfig.JOB_TIMEOUT * 2)}

def get_job_result(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve job result"""
    if redis_client:
        result = redis_client.get(f"job:{job_id}")
        return json.loads(result) if result else None
    else:
        job_data = job_store.get(job_id)
        if job_data and job_data["expiry"] > time.time():
            return job_data["result"]
        elif job_id in job_store:
            del job_store[job_id]
        return None

# =========================
# API Endpoints
# =========================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "academic-records-extraction",
        "version": "3.0.0-fallback",
        "workers": ServerConfig.MAX_WORKERS,
        "redis_connected": redis_client is not None,
        "gap_detection_enabled": True,  # Always enabled
        "fallback_enabled": True,
        "metrics": metrics.get_metrics()
    }), 200

@app.route('/api/extract/sync', methods=['POST'])
def extract_sync():
    """Synchronous extraction endpoint - accepts both JSON and form-data"""
    start_time = time.time()
    try:
        uploaded_paths = {}
        job_id = str(uuid.uuid4())
        
        # Check if request has files (form-data)
        if request.files:
            logger.info("Processing form-data request")
            
            if 'class10' in request.files:
                file = request.files['class10']
                path = save_uploaded_file(file, job_id, "class10")
                if path:
                    uploaded_paths['class10'] = path
            
            if 'class12' in request.files:
                file = request.files['class12']
                path = save_uploaded_file(file, job_id, "class12")
                if path:
                    uploaded_paths['class12'] = path
            
            if 'graduation' in request.files:
                file = request.files['graduation']
                path = save_uploaded_file(file, job_id, "graduation")
                if path:
                    uploaded_paths['graduation_pdf'] = path
            
            if not uploaded_paths:
                return jsonify({
                    "status": "error",
                    "message": "No valid files uploaded"
                }), 400
        
        # Check if request has JSON data
        elif request.is_json:
            data = request.json
            uploaded_paths = {
                "class10": data.get("class10", ""),
                "class12": data.get("class12", ""),
                "graduation_pdf": data.get("graduation_pdf", ""),
                "certificates": data.get("certificates", [])
            }
        
        else:
            return jsonify({
                "status": "error",
                "message": "Request must be either form-data or JSON"
            }), 400
        
        # Check if we have at least one document
        if not any([uploaded_paths.get('class10'), uploaded_paths.get('class12'), uploaded_paths.get('graduation_pdf')]):
            return jsonify({
                "status": "error",
                "message": "At least one document (class10, class12, or graduation) is required"
            }), 400
        
        # Process the documents
        result = process_academic_records_enhanced(
            inputs={
                "class10": uploaded_paths.get('class10', ''),
                "class12": uploaded_paths.get('class12', ''),
                "graduation_pdf": uploaded_paths.get('graduation_pdf', ''),
                "certificates": uploaded_paths.get('certificates', [])
            },
            use_groq_verifier=False,
            enable_gap_detection=True  # Always enable gap detection
        )
        
        processing_time = time.time() - start_time
        metrics.record_request(success=True, processing_time=processing_time)
        
        response = {
            "status": "success",
            "processing_time": processing_time,
            "gap_detection_enabled": True,
            "data": result
        }
        
        # Clean up uploaded files after processing
        for path in uploaded_paths.values():
            if isinstance(path, str) and os.path.exists(path):
                try:
                    os.remove(path)
                    logger.info(f"Cleaned up file: {path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup file {path}: {e}")
        
        return jsonify(response), 200
    
    except Exception as e:
        logger.error(f"Sync extraction failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(success=False, processing_time=processing_time)
        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

@app.route('/api/extract/async', methods=['POST'])
def extract_async():
    """Asynchronous extraction endpoint"""
    start_time = time.time()
    try:
        job_id = str(uuid.uuid4())
        uploaded_paths = {}
        
        # Check if request has files (form-data)
        if request.files:
            logger.info("Processing async form-data request")
            
            if 'class10' in request.files:
                file = request.files['class10']
                path = save_uploaded_file(file, job_id, "class10")
                if path:
                    uploaded_paths['class10'] = path
            
            if 'class12' in request.files:
                file = request.files['class12']
                path = save_uploaded_file(file, job_id, "class12")
                if path:
                    uploaded_paths['class12'] = path
            
            if 'graduation' in request.files:
                file = request.files['graduation']
                path = save_uploaded_file(file, job_id, "graduation")
                if path:
                    uploaded_paths['graduation_pdf'] = path
            
            if not uploaded_paths:
                return jsonify({
                    "status": "error",
                    "message": "No valid files uploaded"
                }), 400
        
        # Check if request has JSON data
        elif request.is_json:
            data = request.json
            uploaded_paths = {
                "class10": data.get("class10", ""),
                "class12": data.get("class12", ""),
                "graduation_pdf": data.get("graduation_pdf", ""),
                "certificates": data.get("certificates", [])
            }
        
        else:
            return jsonify({
                "status": "error",
                "message": "Request must be either form-data or JSON"
            }), 400
        
        job_data = {
            "job_id": job_id,
            "inputs": {
                "class10": uploaded_paths.get('class10', ''),
                "class12": uploaded_paths.get('class12', ''),
                "graduation_pdf": uploaded_paths.get('graduation_pdf', ''),
                "certificates": uploaded_paths.get('certificates', [])
            },
            "created_at": datetime.now().isoformat()
        }
        
        # Submit job to process pool
        future = process_pool.submit(process_job_worker, job_data)
        
        initial_result = {
            "status": "processing",
            "job_id": job_id,
            "created_at": job_data["created_at"],
            "message": "Job submitted for processing"
        }
        store_job_result(job_id, initial_result)
        
        def job_done(f):
            try:
                result = f.result(timeout=ServerConfig.JOB_TIMEOUT)
                store_job_result(job_id, result)
                # Clean up files after processing
                for path in uploaded_paths.values():
                    if isinstance(path, str) and os.path.exists(path):
                        try:
                            os.remove(path)
                        except:
                            pass
            except Exception as e:
                error_result = {
                    "status": "failed",
                    "job_id": job_id,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
                store_job_result(job_id, error_result)
        
        future.add_done_callback(job_done)
        
        processing_time = time.time() - start_time
        metrics.record_request(success=True, processing_time=processing_time)
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "message": "Job submitted for processing",
            "status_url": f"/api/job/{job_id}",
            "processing_time": processing_time
        }), 202
    
    except Exception as e:
        logger.error(f"Async job submission failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(success=False, processing_time=processing_time)
        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id: str):
    """Get job status and result"""
    result = get_job_result(job_id)
    
    if not result:
        return jsonify({
            "status": "error",
            "message": "Job not found or expired"
        }), 404
    
    return jsonify(result), 200

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload files endpoint - returns paths for later processing"""
    try:
        job_id = str(uuid.uuid4())
        uploaded_paths = {}
        
        if 'class10' in request.files:
            file = request.files['class10']
            path = save_uploaded_file(file, job_id, "class10")
            if path:
                uploaded_paths['class10'] = path
        
        if 'class12' in request.files:
            file = request.files['class12']
            path = save_uploaded_file(file, job_id, "class12")
            if path:
                uploaded_paths['class12'] = path
        
        if 'graduation' in request.files:
            file = request.files['graduation']
            path = save_uploaded_file(file, job_id, "graduation")
            if path:
                uploaded_paths['graduation_pdf'] = path
        
        if not uploaded_paths:
            return jsonify({
                "status": "error",
                "message": "No valid files uploaded"
            }), 400
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "uploaded_files": uploaded_paths,
            "message": "Files uploaded successfully",
            "extraction_url": f"/api/extract/sync",
            "async_extraction_url": f"/api/extract/async"
        }), 200
    
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# =========================
# Error Handlers
# =========================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"status": "error", "message": "Endpoint not found"}), 404

@app.errorhandler(413)
def too_large(error):
    return jsonify({"status": "error", "message": f"File too large"}), 413

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"status": "error", "message": "Internal server error"}), 500

# =========================
# Shutdown Handler
# =========================

def shutdown_handler(signum, frame):
    """Graceful shutdown handler"""
    logger.info("Shutdown signal received. Shutting down gracefully...")
    process_pool.shutdown(wait=True)
    logger.info("Server shutdown complete")
    exit(0)

# =========================
# Main Entry Point
# =========================

if __name__ == '__main__':
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    
    print("=" * 80)
    print("🚀 Academic Records Extraction Server Starting")
    print("=" * 80)
    print(f"🌐 Port: {ServerConfig.PORT}")
    print(f"🔧 Max workers: {ServerConfig.MAX_WORKERS}")
    print(f"💾 Upload folder: {ServerConfig.UPLOAD_FOLDER}")
    print(f"🔄 Fallback: OpenRouter enabled")
    print(f"📊 Gap detection: Always Enabled")
    print(f"📋 Redis: {'Connected' if redis_client else 'Disconnected (using in-memory storage)'}")
    print("=" * 80)
    
    app.run(
        host=ServerConfig.HOST,
        port=ServerConfig.PORT,
        debug=ServerConfig.DEBUG,
        threaded=True
    )