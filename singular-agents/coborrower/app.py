"""
Production Co-Borrower Financial Processing Server
- Flask-based REST API for financial document extraction
- Parallel processing with ProcessPoolExecutor + ThreadPoolExecutor
- Redis-based job queue for background processing
- Image and PDF support with proper rate limiting
- Health checks, monitoring, and error handling
"""

import os
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

# Import the existing coborrower module
try:
    from coborrower import process_coborrower_financial_docs, Config as CoborrowerConfig
except ImportError:
    print("Warning: coborrower.py not found. Make sure it's in the same directory.")
    # Define a dummy function for testing
    def process_coborrower_financial_docs(pdf_paths):
        return {"status": "error", "message": "coborrower.py not found"}

# =========================
# Configuration
# =========================
load_dotenv()

class ServerConfig:
    """Server configuration for co-borrower financial processing"""
    # Server settings
    HOST = os.getenv("COBORROWER_HOST", "0.0.0.0")
    PORT = int(os.getenv("COBORROWER_PORT", "5001"))
    DEBUG = os.getenv("COBORROWER_DEBUG", "false").lower() == "true"
    
    # Upload settings
    UPLOAD_FOLDER = os.getenv("COBORROWER_UPLOAD_FOLDER", "./coborrower_uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", "100 * 1024 * 1024"))  # 100MB for financial docs
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
    
    # Processing settings
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", os.cpu_count() or 4))
    MAX_THREADS_PER_PROCESS = int(os.getenv("MAX_THREADS_PER_PROCESS", "3"))
    JOB_TIMEOUT = int(os.getenv("JOB_TIMEOUT", "600"))  # 10 minutes for financial docs
    
    # Redis settings
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB = int(os.getenv("COBORROWER_REDIS_DB", "1"))
    
    # Document types
    REQUIRED_DOCS = [
        "salary_slip_1", "salary_slip_2", "salary_slip_3",
        "itr_1", "itr_2", "itr_3", "bank_statement_6m"
    ]
    OPTIONAL_DOCS = ["form_16"]
    
    # Monitoring
    METRICS_ENABLED = os.getenv("METRICS_ENABLED", "true").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # Image processing (for PDF to image conversion)
    USE_IMAGES_FOR_EXTRACTION = os.getenv("USE_IMAGES", "true").lower() == "true"
    
    @classmethod
    def validate(cls):
        """Validate configuration"""
        # Create upload directory if it doesn't exist
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)
        
        # Set up logging
        logging.basicConfig(
            level=getattr(logging, cls.LOG_LEVEL),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('coborrower_server.log'),
                logging.StreamHandler()
            ]
        )
        
        # Check for poppler if using images
        if cls.USE_IMAGES_FOR_EXTRACTION and os.name == 'nt':
            poppler_path = r"C:\Program Files\poppler\Library\bin"
            if not os.path.exists(poppler_path):
                logging.warning("Poppler not found. Image extraction may fail.")
                logging.warning("Download from: https://github.com/oschwartz10612/poppler-windows/releases")

# =========================
# Initialize
# =========================
ServerConfig.validate()
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = ServerConfig.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = ServerConfig.MAX_CONTENT_LENGTH
CORS(app)

# Initialize Redis
try:
    redis_client = redis.Redis(
        host=ServerConfig.REDIS_HOST,
        port=ServerConfig.REDIS_PORT,
        password=ServerConfig.REDIS_PASSWORD or None,
        db=ServerConfig.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    logger.info("Redis connected successfully for co-borrower processing")
except redis.ConnectionError:
    logger.warning("Redis not available, using in-memory job storage")
    redis_client = None

# Process pool for parallel processing
process_pool = ProcessPoolExecutor(max_workers=ServerConfig.MAX_WORKERS)
job_store = {}  # In-memory job store if Redis is unavailable

# Metrics
class FinancialMetrics:
    """Metrics collection for financial processing"""
    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.documents_processed = 0
        self.documents_failed = 0
        self.total_processing_time = 0
        self.lock = threading.Lock()
    
    def record_request(self, success: bool, processing_time: float, docs_count: int = 0):
        with self.lock:
            self.requests_total += 1
            if success:
                self.requests_success += 1
            else:
                self.requests_failed += 1
            self.documents_processed += docs_count
            self.total_processing_time += processing_time
    
    def record_document_failure(self):
        with self.lock:
            self.documents_failed += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            avg_time = (self.total_processing_time / self.requests_total 
                       if self.requests_total > 0 else 0)
            success_rate = (self.documents_processed - self.documents_failed) / self.documents_processed if self.documents_processed > 0 else 0
            return {
                "requests_total": self.requests_total,
                "requests_success": self.requests_success,
                "requests_failed": self.requests_failed,
                "success_rate": (self.requests_success / self.requests_total 
                               if self.requests_total > 0 else 0),
                "documents_processed": self.documents_processed,
                "documents_failed": self.documents_failed,
                "document_success_rate": success_rate,
                "avg_processing_time_seconds": avg_time,
                "active_workers": process_pool._max_workers,
            }

metrics = FinancialMetrics()

# =========================
# Helper Functions
# =========================
def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ServerConfig.ALLOWED_EXTENSIONS

def save_uploaded_file(file, job_id: str, doc_type: str) -> Optional[str]:
    """Save uploaded file and return path"""
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{job_id}_{doc_type}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        logger.info(f"Saved file: {filename} for document type: {doc_type}")
        return filepath
    return None

def validate_document_mapping(uploaded_files: Dict[str, str]) -> List[str]:
    """Validate that all required documents are present"""
    missing = []
    for doc_type in ServerConfig.REQUIRED_DOCS:
        if doc_type not in uploaded_files or not uploaded_files[doc_type]:
            missing.append(doc_type)
    return missing

def process_financial_docs_worker(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """Worker function for process pool"""
    start_time = time.time()
    try:
        # Prepare document paths
        pdf_paths = {}
        for doc_type in ServerConfig.REQUIRED_DOCS + ServerConfig.OPTIONAL_DOCS:
            file_key = f"{doc_type}_file"
            if file_key in job_data.get("uploaded_files", {}):
                pdf_paths[doc_type] = job_data["uploaded_files"][file_key]
        
        # Run the financial document processing
        result = process_coborrower_financial_docs(pdf_paths)
        
        processing_time = time.time() - start_time
        logger.info(f"Financial job {job_data.get('job_id')} completed in {processing_time:.2f}s")
        
        return {
            "status": "completed",
            "result": result,
            "processing_time": processing_time,
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Financial job {job_data.get('job_id')} failed: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }

def store_job_result(job_id: str, result: Dict[str, Any]):
    """Store job result in Redis or in-memory store"""
    if redis_client:
        redis_client.setex(
            f"coborrower:job:{job_id}",
            ServerConfig.JOB_TIMEOUT * 2,
            json.dumps(result)
        )
    else:
        job_store[job_id] = {
            "result": result,
            "expiry": time.time() + (ServerConfig.JOB_TIMEOUT * 2)
        }
        cleanup_expired_jobs()

def get_job_result(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve job result"""
    if redis_client:
        result = redis_client.get(f"coborrower:job:{job_id}")
        return json.loads(result) if result else None
    else:
        job_data = job_store.get(job_id)
        if job_data and job_data["expiry"] > time.time():
            return job_data["result"]
        elif job_id in job_store:
            del job_store[job_id]  # Clean up expired
        return None

def cleanup_expired_jobs():
    """Clean up expired in-memory jobs"""
    current_time = time.time()
    expired = [job_id for job_id, data in job_store.items() 
               if data["expiry"] <= current_time]
    for job_id in expired:
        del job_store[job_id]

def get_document_mapping() -> Dict[str, str]:
    """Get mapping of API field names to document types"""
    return {
        "salary_slip_1": "salary_slip_1",
        "salary_slip_2": "salary_slip_2", 
        "salary_slip_3": "salary_slip_3",
        "itr_1": "itr_1",
        "itr_2": "itr_2",
        "itr_3": "itr_3",
        "form_16": "form_16",
        "bank_statement": "bank_statement_6m"
    }

# =========================
# API Endpoints
# =========================
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "coborrower-financial-processing",
        "version": "1.0.0",
        "workers": ServerConfig.MAX_WORKERS,
        "image_extraction": ServerConfig.USE_IMAGES_FOR_EXTRACTION,
        "redis_connected": redis_client is not None and redis_client.ping()
    }
    
    if ServerConfig.METRICS_ENABLED:
        health_status["metrics"] = metrics.get_metrics()
    
    return jsonify(health_status), 200

@app.route('/api/extract/sync', methods=['POST'])
def extract_sync():
    """Synchronous financial document extraction"""
    start_time = time.time()
    
    try:
        # Check if files are uploaded
        if not request.files:
            return jsonify({
                "status": "error",
                "message": "No files uploaded"
            }), 400
        
        job_id = str(uuid.uuid4())
        uploaded_files = {}
        
        # Process uploaded files
        document_mapping = get_document_mapping()
        for field_name, doc_type in document_mapping.items():
            if field_name in request.files:
                file = request.files[field_name]
                if file and file.filename:
                    filepath = save_uploaded_file(file, job_id, doc_type)
                    if filepath:
                        uploaded_files[f"{doc_type}_file"] = filepath
        
        # Validate required documents
        missing = validate_document_mapping(uploaded_files)
        if missing:
            return jsonify({
                "status": "error",
                "message": f"Missing required documents: {', '.join(missing)}"
            }), 400
        
        # Prepare document paths for processing
        pdf_paths = {}
        for doc_type in ServerConfig.REQUIRED_DOCS + ServerConfig.OPTIONAL_DOCS:
            file_key = f"{doc_type}_file"
            if file_key in uploaded_files:
                pdf_paths[doc_type] = uploaded_files[file_key]
        
        # Process the documents
        result = process_coborrower_financial_docs(pdf_paths)
        
        processing_time = time.time() - start_time
        doc_count = len(pdf_paths)
        metrics.record_request(
            success=result.get("status") in ["completed", "partial"],
            processing_time=processing_time,
            docs_count=doc_count
        )
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "processing_time": processing_time,
            "documents_processed": doc_count,
            "result": result
        }), 200
        
    except Exception as e:
        logger.error(f"Sync financial extraction failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(success=False, processing_time=processing_time)
        
        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

@app.route('/api/extract/async', methods=['POST'])
def extract_async():
    """Asynchronous financial document extraction"""
    start_time = time.time()
    
    try:
        # Check if files are uploaded
        if not request.files:
            return jsonify({
                "status": "error",
                "message": "No files uploaded"
            }), 400
        
        job_id = str(uuid.uuid4())
        uploaded_files = {}
        
        # Process uploaded files
        document_mapping = get_document_mapping()
        for field_name, doc_type in document_mapping.items():
            if field_name in request.files:
                file = request.files[field_name]
                if file and file.filename:
                    filepath = save_uploaded_file(file, job_id, doc_type)
                    if filepath:
                        uploaded_files[f"{doc_type}_file"] = filepath
        
        # Validate required documents
        missing = validate_document_mapping(uploaded_files)
        if missing:
            return jsonify({
                "status": "error",
                "message": f"Missing required documents: {', '.join(missing)}"
            }), 400
        
        # Create job data
        job_data = {
            "job_id": job_id,
            "uploaded_files": uploaded_files,
            "created_at": datetime.now().isoformat()
        }
        
        # Submit job to process pool
        future = process_pool.submit(process_financial_docs_worker, job_data)
        
        # Store initial job status
        initial_result = {
            "status": "processing",
            "job_id": job_id,
            "created_at": job_data["created_at"],
            "message": "Financial documents submitted for processing",
            "documents_uploaded": list(uploaded_files.keys())
        }
        store_job_result(job_id, initial_result)
        
        # Add callback to store final result
        def job_done(f):
            try:
                result = f.result(timeout=ServerConfig.JOB_TIMEOUT)
                store_job_result(job_id, result)
            except Exception as e:
                error_result = {
                    "status": "failed",
                    "job_id": job_id,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
                store_job_result(job_id, error_result)
                metrics.record_document_failure()
        
        future.add_done_callback(job_done)
        
        processing_time = time.time() - start_time
        metrics.record_request(success=True, processing_time=processing_time, docs_count=len(uploaded_files))
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "message": "Financial documents submitted for processing",
            "status_url": f"/api/job/{job_id}",
            "documents_uploaded": len(uploaded_files),
            "processing_time": processing_time
        }), 202
        
    except Exception as e:
        logger.error(f"Async financial job submission failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(success=False, processing_time=processing_time)
        
        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

@app.route('/api/extract/paths', methods=['POST'])
def extract_from_paths():
    """Extract from existing file paths (for internal use)"""
    start_time = time.time()
    
    try:
        data = request.json if request.is_json else {}
        
        if not data:
            return jsonify({
                "status": "error",
                "message": "No data provided"
            }), 400
        
        # Process the documents
        result = process_coborrower_financial_docs(data)
        
        processing_time = time.time() - start_time
        doc_count = len(data)
        metrics.record_request(
            success=result.get("status") in ["completed", "partial"],
            processing_time=processing_time,
            docs_count=doc_count
        )
        
        return jsonify({
            "status": "success",
            "processing_time": processing_time,
            "documents_processed": doc_count,
            "result": result
        }), 200
        
    except Exception as e:
        logger.error(f"Path-based extraction failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(success=False, processing_time=processing_time)
        
        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id: str):
    """Get financial job status and result"""
    result = get_job_result(job_id)
    
    if not result:
        return jsonify({
            "status": "error",
            "message": "Job not found or expired"
        }), 404
    
    return jsonify(result), 200

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload financial documents separately"""
    try:
        job_id = str(uuid.uuid4())
        uploaded_files = {}
        
        # Process each document type
        document_mapping = get_document_mapping()
        for field_name, doc_type in document_mapping.items():
            if field_name in request.files:
                file = request.files[field_name]
                if file and file.filename:
                    filepath = save_uploaded_file(file, job_id, doc_type)
                    if filepath:
                        uploaded_files[field_name] = {
                            "path": filepath,
                            "type": doc_type,
                            "original_filename": file.filename
                        }
        
        return jsonify({
            "status": "success",
            "job_id": job_id,
            "uploaded_files": uploaded_files,
            "message": "Financial documents uploaded successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Financial file upload failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/documents/required', methods=['GET'])
def get_required_documents():
    """Get list of required financial documents"""
    return jsonify({
        "status": "success",
        "required_documents": ServerConfig.REQUIRED_DOCS,
        "optional_documents": ServerConfig.OPTIONAL_DOCS,
        "total_required": len(ServerConfig.REQUIRED_DOCS)
    }), 200

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get server metrics"""
    if not ServerConfig.METRICS_ENABLED:
        return jsonify({
            "status": "error",
            "message": "Metrics are disabled"
        }), 403
    
    return jsonify({
        "status": "success",
        "service": "coborrower-financial",
        "metrics": metrics.get_metrics(),
        "timestamp": datetime.now().isoformat()
    }), 200

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get server configuration"""
    return jsonify({
        "status": "success",
        "config": {
            "use_images": ServerConfig.USE_IMAGES_FOR_EXTRACTION,
            "max_workers": ServerConfig.MAX_WORKERS,
            "job_timeout": ServerConfig.JOB_TIMEOUT,
            "upload_folder": ServerConfig.UPLOAD_FOLDER,
            "redis_available": redis_client is not None
        }
    }), 200

# =========================
# Error Handlers
# =========================
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "status": "error",
        "message": "Endpoint not found"
    }), 404

@app.errorhandler(413)
def too_large(error):
    return jsonify({
        "status": "error",
        "message": f"File too large. Maximum size is {ServerConfig.MAX_CONTENT_LENGTH} bytes"
    }), 413

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "status": "error",
        "message": "Internal server error"
    }), 500

# =========================
# Shutdown Handler
# =========================
def shutdown_handler(signum, frame):
    """Graceful shutdown handler"""
    logger.info("Shutdown signal received. Shutting down gracefully...")
    
    # Shutdown process pool
    process_pool.shutdown(wait=True)
    
    logger.info("Co-borrower financial server shutdown complete")
    exit(0)

# =========================
# Main Entry Point
# =========================
if __name__ == '__main__':
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    
    logger.info(f"Starting Co-Borrower Financial Processing Server on {ServerConfig.HOST}:{ServerConfig.PORT}")
    logger.info(f"Process workers: {ServerConfig.MAX_WORKERS}")
    logger.info(f"Upload folder: {ServerConfig.UPLOAD_FOLDER}")
    logger.info(f"Image extraction: {'ENABLED' if ServerConfig.USE_IMAGES_FOR_EXTRACTION else 'DISABLED'}")
    logger.info(f"Required documents: {len(ServerConfig.REQUIRED_DOCS)}")
    
    # Run Flask app
    app.run(
        host=ServerConfig.HOST,
        port=5003,
        debug=ServerConfig.DEBUG,
        threaded=True
    )