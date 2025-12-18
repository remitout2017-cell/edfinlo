"""
Production Work Experience Extraction Server
- Flask REST API with LangGraph workflow
- Parallel processing with multiprocessing
- Redis job queue for background processing
- Advanced monitoring and metrics
- Automatic temporary file cleanup
"""

import os
import json
import uuid
import time
import signal
import logging
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import redis
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
load_dotenv()

# Import work experience processor
try:
    from work_experience import (
        get_work_experience_processor,
        Config as WorkConfig,
        DocumentLoader
    )
except ImportError as e:
    print(f"Warning: work_experience module import failed: {e}")
    # Create mock processor for testing

    class MockProcessor:
        def process_documents(self, file_paths):
            return {"success": False, "error": "Module not loaded"}

    def get_work_experience_processor(): return MockProcessor()

# =========================
# Configuration
# =========================


class ServerConfig:
    """Server configuration for work experience processing"""

    # Server settings
    HOST = os.getenv("WORK_HOST", "0.0.0.0")
    PORT = int(os.getenv("WORK_PORT", "5002"))
    DEBUG = os.getenv("WORK_DEBUG", "false").lower() == "true"

    # Upload settings
    UPLOAD_FOLDER = os.getenv("WORK_UPLOAD_FOLDER",
                              "./work_experience_uploads")
    MAX_CONTENT_LENGTH = int(
        os.getenv("MAX_CONTENT_LENGTH", "100")) * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

    # Processing settings
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", os.cpu_count() or 4))
    MAX_THREADS_PER_PROCESS = int(os.getenv("MAX_THREADS_PER_PROCESS", "8"))
    JOB_TIMEOUT = int(os.getenv("WORK_JOB_TIMEOUT", "600"))  # 10 minutes

    # Redis settings
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB = int(os.getenv("WORK_REDIS_DB", "2"))

    # Document limits
    MAX_DOCUMENTS_PER_REQUEST = int(os.getenv("MAX_DOCUMENTS", "10"))
    MAX_DOCUMENT_SIZE_MB = int(os.getenv("MAX_DOCUMENT_SIZE_MB", "50"))

    # Monitoring
    METRICS_ENABLED = os.getenv("METRICS_ENABLED", "true").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    ENABLE_PROMETHEUS = os.getenv(
        "ENABLE_PROMETHEUS", "false").lower() == "true"

    # Cleanup settings
    TEMP_FILE_MAX_AGE_MINUTES = int(
        os.getenv("TEMP_FILE_MAX_AGE_MINUTES", "30"))
    CLEANUP_INTERVAL_MINUTES = int(os.getenv("CLEANUP_INTERVAL_MINUTES", "10"))

    @classmethod
    def validate(cls):
        """Validate configuration"""
        # Create upload directory
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)

        # Setup logging
        logging.basicConfig(
            level=getattr(logging, cls.LOG_LEVEL),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('work_experience_server.log'),
                logging.StreamHandler()
            ]
        )

        # Check Redis
        try:
            redis_client = redis.Redis(
                host=cls.REDIS_HOST,
                port=cls.REDIS_PORT,
                password=cls.REDIS_PASSWORD or None,
                db=cls.REDIS_DB
            )
            redis_client.ping()
            logging.info("✅ Redis configuration validated")
        except redis.ConnectionError:
            logging.warning("⚠️ Redis not available, using in-memory storage")


# =========================
# Initialize Configuration First
# =========================
ServerConfig.validate()
logger = logging.getLogger(__name__)

# =========================
# Automatic Cleanup Scheduler
# =========================


class TempFileCleanupScheduler:
    """Background scheduler to clean up old temporary files"""

    def __init__(self, upload_folder: str, max_age_minutes: int = 30, check_interval_minutes: int = 10):
        self.upload_folder = upload_folder
        self.max_age_minutes = max_age_minutes
        self.check_interval_minutes = check_interval_minutes
        self.running = False
        self.thread = None

    def start(self):
        """Start the cleanup scheduler"""
        if self.running:
            logger.warning("Cleanup scheduler already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.thread.start()
        logger.info(
            f"✅ Cleanup scheduler started (checking every {self.check_interval_minutes} minutes)")

    def stop(self):
        """Stop the cleanup scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("🛑 Cleanup scheduler stopped")

    def _cleanup_loop(self):
        """Main cleanup loop"""
        while self.running:
            try:
                self._cleanup_old_files()
            except Exception as e:
                logger.error(f"❌ Cleanup task error: {str(e)}")

            # Wait before next cleanup
            interval_seconds = self.check_interval_minutes * 60
            for _ in range(interval_seconds):
                if not self.running:
                    break
                time.sleep(1)

    def _cleanup_old_files(self):
        """Delete files older than max_age_minutes"""
        try:
            if not os.path.exists(self.upload_folder):
                return

            cutoff_time = datetime.now() - timedelta(minutes=self.max_age_minutes)
            deleted_count = 0
            total_size = 0

            for filename in os.listdir(self.upload_folder):
                filepath = os.path.join(self.upload_folder, filename)

                if not os.path.isfile(filepath):
                    continue

                # Check file age
                file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))

                if file_mtime < cutoff_time:
                    try:
                        file_size = os.path.getsize(filepath)
                        os.remove(filepath)
                        deleted_count += 1
                        total_size += file_size
                        logger.debug(f"🗑️ Deleted old file: {filename}")
                    except Exception as e:
                        logger.warning(
                            f"⚠️ Failed to delete {filename}: {str(e)}")

            if deleted_count > 0:
                size_mb = total_size / (1024 * 1024)
                logger.info(
                    f"🧹 Cleanup: Deleted {deleted_count} old file(s), freed {size_mb:.2f}MB")

        except Exception as e:
            logger.error(f"❌ Cleanup failed: {str(e)}")


def cleanup_temp_files(file_paths: List[str]):
    """Delete temporary files after processing"""
    if not file_paths:
        return

    deleted_count = 0
    for filepath in file_paths:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                deleted_count += 1
                logger.debug(
                    f"🗑️ Deleted temp file: {os.path.basename(filepath)}")
        except Exception as e:
            logger.warning(
                f"⚠️ Failed to delete temp file {filepath}: {str(e)}")

    if deleted_count > 0:
        logger.info(f"✅ Cleaned up {deleted_count} temporary file(s)")

# =========================
# Initialize Flask & Services
# =========================


# Flask app
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = ServerConfig.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = ServerConfig.MAX_CONTENT_LENGTH
CORS(app)

# Redis client
try:
    redis_client = redis.Redis(
        host=ServerConfig.REDIS_HOST,
        port=ServerConfig.REDIS_PORT,
        password=ServerConfig.REDIS_PASSWORD or None,
        db=ServerConfig.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    logger.info("✅ Redis connected for work experience processing")
except redis.ConnectionError:
    logger.warning("⚠️ Redis not available, using in-memory job storage")
    redis_client = None

# Process pool
process_pool = ProcessPoolExecutor(max_workers=ServerConfig.MAX_WORKERS)
job_store = {}  # In-memory store

# Initialize cleanup scheduler
cleanup_scheduler = TempFileCleanupScheduler(
    upload_folder=ServerConfig.UPLOAD_FOLDER,
    max_age_minutes=ServerConfig.TEMP_FILE_MAX_AGE_MINUTES,
    check_interval_minutes=ServerConfig.CLEANUP_INTERVAL_MINUTES
)

# Start scheduler
cleanup_scheduler.start()

# =========================
# Metrics
# =========================


class WorkMetrics:
    """Metrics for work experience processing"""

    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.documents_processed = 0
        self.extractions_successful = 0
        self.verifications_valid = 0
        self.total_processing_time = 0
        self.jobs_completed = 0
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

    def record_extraction(self, successful: bool):
        with self.lock:
            if successful:
                self.extractions_successful += 1

    def record_verification(self, valid: bool):
        with self.lock:
            if valid:
                self.verifications_valid += 1

    def record_job_completion(self):
        with self.lock:
            self.jobs_completed += 1

    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            avg_time = (self.total_processing_time / self.requests_total
                        if self.requests_total > 0 else 0)

            extraction_rate = (self.extractions_successful / self.documents_processed
                               if self.documents_processed > 0 else 0)

            verification_rate = (self.verifications_valid / self.extractions_successful
                                 if self.extractions_successful > 0 else 0)

            return {
                "requests_total": self.requests_total,
                "requests_success": self.requests_success,
                "requests_failed": self.requests_failed,
                "success_rate": (self.requests_success / self.requests_total
                                 if self.requests_total > 0 else 0),
                "documents_processed": self.documents_processed,
                "extraction_success_rate": extraction_rate,
                "verification_success_rate": verification_rate,
                "avg_processing_time_seconds": avg_time,
                "jobs_completed": self.jobs_completed,
                "active_workers": process_pool._max_workers,
                "timestamp": datetime.now().isoformat()
            }


metrics = WorkMetrics()

# =========================
# Helper Functions
# =========================


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower(
           ) in ServerConfig.ALLOWED_EXTENSIONS


def save_uploaded_file(file, job_id: str, index: int = 0) -> Optional[str]:
    """Save uploaded file and return path"""
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{job_id}_{index}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # Check file size before saving
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset position

        if file_size > ServerConfig.MAX_DOCUMENT_SIZE_MB * 1024 * 1024:
            raise ValueError(
                f"File too large. Max size: {ServerConfig.MAX_DOCUMENT_SIZE_MB}MB")

        file.save(filepath)
        logger.info(
            f"Saved work document: {filename} ({file_size/(1024*1024):.2f}MB)")
        return filepath
    return None


def store_job_result(job_id: str, result: Dict[str, Any]):
    """Store job result"""
    if redis_client:
        redis_client.setex(
            f"work:job:{job_id}",
            ServerConfig.JOB_TIMEOUT * 2,
            json.dumps(result)
        )
    else:
        job_store[job_id] = {
            "result": result,
            "expiry": time.time() + (ServerConfig.JOB_TIMEOUT * 2)
        }


def get_job_result(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job result"""
    if redis_client:
        result = redis_client.get(f"work:job:{job_id}")
        return json.loads(result) if result else None
    else:
        job_data = job_store.get(job_id)
        if job_data and job_data["expiry"] > time.time():
            return job_data["result"]
        elif job_id in job_store:
            del job_store[job_id]
        return None


def process_work_documents_worker(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """Worker function for processing work documents"""
    start_time = time.time()
    document_paths = job_data.get("document_paths", [])

    try:
        # Get processor
        processor = get_work_experience_processor()

        # Process documents
        result = processor.process_documents(document_paths)

        processing_time = time.time() - start_time

        # Update metrics
        if result.get("success"):
            result_data = result.get("result", {})
            stats = result_data.get("statistics", {})

            metrics.record_extraction(True)
            metrics.record_verification(
                stats.get("verifications_valid", 0) > 0)
            metrics.record_job_completion()

        logger.info(
            f"✅ Work job {job_data.get('job_id')} completed in {processing_time:.2f}s")

        return {
            "status": "completed",
            "result": result,
            "processing_time": processing_time,
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Work job {job_data.get('job_id')} failed: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "job_id": job_data.get("job_id"),
            "timestamp": datetime.now().isoformat()
        }

    finally:
        # ✅ Always cleanup temp files
        cleanup_temp_files(document_paths)

# =========================
# API Endpoints
# =========================


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "work-experience-extraction",
        "version": "2.0.0",
        "workers": ServerConfig.MAX_WORKERS,
        "model": WorkConfig.EXTRACTION_MODEL,
        "image_extraction": WorkConfig.USE_IMAGE_EXTRACTION,
        "redis_connected": redis_client is not None and redis_client.ping(),
        "cleanup_scheduler": cleanup_scheduler.running
    }

    if ServerConfig.METRICS_ENABLED:
        health_status["metrics"] = metrics.get_metrics()

    return jsonify(health_status), 200


@app.route('/api/extract/sync', methods=['POST'])
def extract_sync():
    """Synchronous extraction endpoint with automatic cleanup"""
    start_time = time.time()
    document_paths = []  # Track files for cleanup

    try:
        # Check for files
        if not request.files:
            return jsonify({
                "status": "error",
                "message": "No files uploaded"
            }), 400

        job_id = str(uuid.uuid4())

        # Save uploaded files temporarily
        for i, (field_name, file) in enumerate(request.files.items()):
            if i >= ServerConfig.MAX_DOCUMENTS_PER_REQUEST:
                break

            if file and file.filename:
                filepath = save_uploaded_file(file, job_id, i)
                if filepath:
                    document_paths.append(filepath)

        if not document_paths:
            return jsonify({
                "status": "error",
                "message": "No valid documents uploaded"
            }), 400

        logger.info(f"📁 Processing {len(document_paths)} temporary files...")

        # Process documents
        processor = get_work_experience_processor()
        result = processor.process_documents(document_paths)

        processing_time = time.time() - start_time

        # Record metrics
        success = result.get("success", False)
        metrics.record_request(success, processing_time, len(document_paths))

        if success:
            result_data = result.get("result", {})
            stats = result_data.get("statistics", {})
            metrics.record_extraction(
                stats.get("extractions_successful", 0) > 0)
            metrics.record_verification(
                stats.get("verifications_valid", 0) > 0)

        return jsonify({
            "status": "success",
            "job_id": job_id,
            "processing_time": processing_time,
            "documents_processed": len(document_paths),
            "result": result
        }), 200

    except Exception as e:
        logger.error(f"❌ Sync work extraction failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(False, processing_time)

        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500

    finally:
        # ✅ CLEANUP: Delete temporary files
        cleanup_temp_files(document_paths)


@app.route('/api/extract/async', methods=['POST'])
def extract_async():
    """Asynchronous extraction endpoint with cleanup"""
    start_time = time.time()

    try:
        # Check for files
        if not request.files:
            return jsonify({
                "status": "error",
                "message": "No files uploaded"
            }), 400

        job_id = str(uuid.uuid4())
        document_paths = []

        # Save uploaded files
        for i, (field_name, file) in enumerate(request.files.items()):
            if i >= ServerConfig.MAX_DOCUMENTS_PER_REQUEST:
                break

            if file and file.filename:
                filepath = save_uploaded_file(file, job_id, i)
                if filepath:
                    document_paths.append(filepath)

        if not document_paths:
            return jsonify({
                "status": "error",
                "message": "No valid documents uploaded"
            }), 400

        # Create job data
        job_data = {
            "job_id": job_id,
            "document_paths": document_paths,
            "created_at": datetime.now().isoformat(),
            "document_count": len(document_paths)
        }

        # Submit to process pool
        future = process_pool.submit(process_work_documents_worker, job_data)

        # Store initial status
        initial_result = {
            "status": "processing",
            "job_id": job_id,
            "created_at": job_data["created_at"],
            "message": "Work experience documents submitted for processing",
            "document_count": len(document_paths)
        }
        store_job_result(job_id, initial_result)

        # Add completion callback with cleanup
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

        future.add_done_callback(job_done)

        processing_time = time.time() - start_time
        metrics.record_request(True, processing_time, len(document_paths))

        return jsonify({
            "status": "success",
            "job_id": job_id,
            "message": "Work experience extraction started",
            "status_url": f"/api/job/{job_id}",
            "documents": len(document_paths),
            "processing_time": processing_time
        }), 202

    except Exception as e:
        logger.error(f"❌ Async work extraction failed: {str(e)}")
        processing_time = time.time() - start_time
        metrics.record_request(False, processing_time)

        return jsonify({
            "status": "error",
            "message": str(e),
            "processing_time": processing_time
        }), 500


@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id: str):
    """Get job status"""
    result = get_job_result(job_id)

    if not result:
        return jsonify({
            "status": "error",
            "message": "Job not found or expired"
        }), 404

    return jsonify(result), 200


@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get processing metrics"""
    if not ServerConfig.METRICS_ENABLED:
        return jsonify({
            "status": "error",
            "message": "Metrics are disabled"
        }), 403

    return jsonify({
        "status": "success",
        "service": "work-experience",
        "metrics": metrics.get_metrics()
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
    """Graceful shutdown"""
    logger.info("Shutdown signal received for work experience server...")

    # Stop cleanup scheduler
    cleanup_scheduler.stop()

    # Shutdown process pool
    process_pool.shutdown(wait=True)

    logger.info("Work experience server shutdown complete")
    exit(0)

# =========================
# Main Entry Point
# =========================


if __name__ == '__main__':
    # Register signal handlers
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info(
        f"🚀 Starting Work Experience Extraction Server on {ServerConfig.HOST}:{ServerConfig.PORT}")
    logger.info(f"📊 Max Workers: {ServerConfig.MAX_WORKERS}")
    logger.info(f"📁 Upload Folder: {ServerConfig.UPLOAD_FOLDER}")
    logger.info(f"🤖 Model: {WorkConfig.EXTRACTION_MODEL}")
    logger.info(
        f"📸 Image Extraction: {'ENABLED' if WorkConfig.USE_IMAGE_EXTRACTION else 'DISABLED'}")
    logger.info(
        f"🧹 Auto Cleanup: Every {ServerConfig.CLEANUP_INTERVAL_MINUTES} min (files older than {ServerConfig.TEMP_FILE_MAX_AGE_MINUTES} min)")

    # Run server
    app.run(
        host=ServerConfig.HOST,
        port=ServerConfig.PORT,
        debug=ServerConfig.DEBUG,
        threaded=True
    )
