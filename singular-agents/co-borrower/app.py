"""
FastAPI Production API for Loan Approval AI - PRODUCTION READY
CORRECTED: Added file validation, better error handling, health checks
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
import os
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
from werkzeug.utils import secure_filename
import hashlib

from main import LoanApprovalEngine
from schemas import LoanApplicationAnalysis
from utils import save_json, create_session_id, setup_logging
from config import Config

# Setup logging
setup_logging(Config.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Loan Approval AI API",
    description="AI-powered loan approval system using Gemini + LangChain",
    version="4.0.0",
    docs_url="/docs" if Config.DEBUG else None,
    redoc_url="/redoc" if Config.DEBUG else None
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Initialize engine (singleton)
engine = None


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    global engine
    logger.info("🚀 Starting Loan Approval AI API...")
    logger.info(f"   Environment: {Config.ENVIRONMENT}")
    logger.info(f"   Model: {Config.GEMINI_MODEL}")
    logger.info(f"   Max File Size: {Config.MAX_FILE_SIZE_MB}MB")

    try:
        engine = LoanApprovalEngine()
        logger.info("✅ API Ready")
    except Exception as e:
        logger.error(f"❌ Failed to initialize engine: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down API...")


def validate_pdf_file(file: UploadFile) -> tuple[bool, Optional[str]]:
    """
    Validate uploaded PDF file
    Returns: (is_valid, error_message)
    """
    # Check file extension
    if not file.filename.lower().endswith('.pdf'):
        return False, "Only PDF files are allowed"

    # Check file size (read content)
    content = file.file.read()
    file.file.seek(0)  # Reset file pointer

    if len(content) > Config.MAX_FILE_SIZE_BYTES:
        return False, f"File too large. Max size: {Config.MAX_FILE_SIZE_MB}MB"

    if len(content) == 0:
        return False, "File is empty"

    # Check PDF signature
    if not content.startswith(b'%PDF'):
        return False, "Invalid PDF file format"

    return True, None


def save_upload(file: UploadFile, session_id: str, prefix: str) -> str:
    """Save uploaded file with validation"""
    # Validate file
    is_valid, error = validate_pdf_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Secure filename
    filename = secure_filename(f"{session_id}_{prefix}_{file.filename}")
    filepath = Config.UPLOAD_DIR / filename

    # Save file
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    logger.info(f"   💾 Saved: {filename}")
    return str(filepath)


def cleanup_files(filepaths: list):
    """Delete temporary files"""
    for filepath in filepaths:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.debug(f"   🗑️  Deleted: {Path(filepath).name}")
        except Exception as e:
            logger.warning(f"   ⚠️  Could not delete {filepath}: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "healthy",
        "service": "Loan Approval AI",
        "version": "4.0.0",
        "powered_by": "Gemini + LangChain",
        "timestamp": datetime.now().isoformat(),
        "docs": "/docs" if Config.DEBUG else "Documentation disabled in production"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    try:
        # Check if engine is initialized
        if engine is None:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "error": "Engine not initialized"
                }
            )

        return {
            "status": "healthy",
            "service": "Loan Approval AI",
            "version": "4.0.0",
            "environment": Config.ENVIRONMENT,
            "model": Config.GEMINI_MODEL,
            "vision_model": Config.GEMINI_VISION_MODEL,
            "capabilities": [
                "ITR extraction (2 years)",
                "Bank statement analysis (6 months)",
                "Salary slip extraction (3 months)",
                "FOIR calculation",
                "CIBIL score estimation"
            ],
            "limits": {
                "max_file_size_mb": Config.MAX_FILE_SIZE_MB,
                "max_pdf_pages": Config.MAX_PDF_PAGES,
                "pdf_dpi": Config.PDF_DPI
            },
            "processing": {
                "parallel_extraction": True,
                "multi_document_support": True,
                "estimated_time": "60-120 seconds"
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@app.get("/api/info")
async def api_info():
    """API information and usage"""
    return {
        "api_version": "4.0.0",
        "service": "Loan Approval AI",
        "technology": {
            "llm": "Google Gemini",
            "framework": "LangChain",
            "model": Config.GEMINI_MODEL,
            "vision_model": Config.GEMINI_VISION_MODEL
        },
        "endpoints": {
            "analyze": {
                "method": "POST",
                "path": "/api/analyze",
                "description": "Analyze complete loan application",
                "required_documents": [
                    "salary_slips_pdf (3 months)",
                    "bank_statement_pdf (6 months)",
                    "itr_pdf_1 (1 year)"
                ],
                "optional_documents": [
                    "itr_pdf_2 (previous year)",
                    "form16_pdf (cross-validation)"
                ]
            }
        },
        "features": [
            "Multi-document parallel processing",
            "Structured data extraction using Pydantic",
            "FOIR calculation with cross-validation",
            "CIBIL score estimation",
            "Comprehensive recommendations"
        ],
        "processing": {
            "average_time": "60-120 seconds",
            "max_file_size_mb": Config.MAX_FILE_SIZE_MB,
            "max_pdf_pages": Config.MAX_PDF_PAGES,
            "supported_formats": ["PDF"],
            "parallel_processing": True
        },
        "rate_limits": {
            "requests_per_minute": "Depends on Gemini API limits",
            "concurrent_requests": Config.API_WORKERS
        },
        "example_curl": """
curl -X POST "http://localhost:8000/api/analyze" \\
  -F "salary_slips_pdf=@salary_slips.pdf" \\
  -F "bank_statement_pdf=@bank_statement.pdf" \\
  -F "itr_pdf_1=@itr_2023_24.pdf" \\
  -F "itr_pdf_2=@itr_2022_23.pdf"
        """.strip()
    }


@app.post("/api/analyze", response_model=dict)
async def analyze_loan_application(
    background_tasks: BackgroundTasks,
    salary_slips_pdf: UploadFile = File(...,
                                        description="Combined salary slips (3 months)"),
    bank_statement_pdf: UploadFile = File(...,
                                          description="Bank statement (6 months)"),
    itr_pdf_1: UploadFile = File(..., description="ITR document year 1"),
    itr_pdf_2: Optional[UploadFile] = File(
        None, description="ITR document year 2 (optional)"),
    form16_pdf: Optional[UploadFile] = File(
        None, description="Form 16 (optional)")
):
    """
    Analyze loan application with all documents

    **Required Documents:**
    - salary_slips_pdf: Combined PDF with 3 months of salary slips
    - bank_statement_pdf: 6 months bank statement
    - itr_pdf_1: ITR document for most recent year

    **Optional Documents:**
    - itr_pdf_2: ITR document for previous year
    - form16_pdf: Form 16 for cross-validation

    **Returns:**
    Complete loan analysis including:
    - Extracted data from all documents
    - FOIR calculation
    - CIBIL score estimation
    - Recommendations
    """
    session_id = create_session_id()
    start_time = datetime.now()

    logger.info(f"\n{'='*80}")
    logger.info(f"📥 NEW REQUEST - Session: {session_id}")
    logger.info(f"{'='*80}")

    uploaded_files = []

    try:
        # Check if engine is ready
        if engine is None:
            raise HTTPException(
                status_code=503,
                detail="Service not ready. Please try again."
            )

        # Save uploaded files with validation
        logger.info("💾 Saving uploaded documents...")

        salary_path = save_upload(salary_slips_pdf, session_id, "salary")
        uploaded_files.append(salary_path)

        bank_path = save_upload(bank_statement_pdf, session_id, "bank")
        uploaded_files.append(bank_path)

        itr1_path = save_upload(itr_pdf_1, session_id, "itr1")
        uploaded_files.append(itr1_path)

        itr2_path = None
        if itr_pdf_2:
            itr2_path = save_upload(itr_pdf_2, session_id, "itr2")
            uploaded_files.append(itr2_path)

        form16_path = None
        if form16_pdf:
            form16_path = save_upload(form16_pdf, session_id, "form16")
            uploaded_files.append(form16_path)

        logger.info("   ✅ All documents saved\n")

        # Process application
        logger.info("📄 Processing loan application...")
        result = engine.process_loan_application(
            salary_slip_pdf=salary_path,
            bank_statement_pdf=bank_path,
            itr_pdf_1=itr1_path,
            itr_pdf_2=itr2_path,
            form16_pdf=form16_path
        )

        # Schedule cleanup
        background_tasks.add_task(cleanup_files, uploaded_files)

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()

        logger.info(f"\n✅ REQUEST COMPLETE - {processing_time:.2f}s")
        logger.info(f"{'='*80}\n")

        # Build response
        response = {
            "status": "success",
            "session_id": session_id,
            "processing_time_seconds": round(processing_time, 2),
            "timestamp": datetime.now().isoformat(),

            # Extraction results
            "extracted_data": {
                "itr": result.itr_data.model_dump(mode='json') if result.itr_data else None,
                "bank_statement": result.bank_data.model_dump(mode='json') if result.bank_data else None,
                "salary_slips": result.salary_data.model_dump(mode='json') if result.salary_data else None
            },

            # Calculations
            "foir": result.foir_result.model_dump(mode='json') if result.foir_result else None,
            "cibil": result.cibil_estimate.model_dump(mode='json') if result.cibil_estimate else None,

            # Quality metrics
            "quality": {
                "overall_confidence": round(result.overall_confidence * 100, 2),
                "data_sources_used": result.data_sources_used,
                "missing_data": result.missing_data
            },

            # Issues and warnings
            "errors": result.errors,

            # Documents processed
            "documents_processed": {
                "salary_slips": True,
                "bank_statement": True,
                "itr_1": True,
                "itr_2": itr_pdf_2 is not None,
                "form16": form16_pdf is not None
            }
        }

        # Save result to disk
        result_path = Config.RESULTS_DIR / f"analysis_{session_id}.json"
        save_json(response, str(result_path))

        return JSONResponse(status_code=200, content=response)

    except HTTPException as he:
        # Re-raise HTTP exceptions
        cleanup_files(uploaded_files)
        raise he

    except Exception as e:
        logger.error(f"\n❌ ERROR: {e}", exc_info=True)

        # Cleanup on error
        cleanup_files(uploaded_files)

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "session_id": session_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "timestamp": datetime.now().isoformat()
            }
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": "Internal server error",
            "detail": str(exc) if Config.DEBUG else "An error occurred"
        }
    )


if __name__ == "__main__":
    print("\n" + "="*80)
    print("🚀 LOAN APPROVAL AI API v4.0 - PRODUCTION READY")
    print("="*80)
    print(f"Environment: {Config.ENVIRONMENT}")
    print(f"Model: {Config.GEMINI_MODEL}")
    print("Features:")
    print("  • Parallel document processing")
    print("  • FOIR calculation")
    print("  • CIBIL estimation")
    print("  • File validation & security")
    print("  • Production error handling")
    print("="*80)
    print(f"🔗 API URL: http://{Config.API_HOST}:{Config.API_PORT}")
    print(f"📖 Docs: http://{Config.API_HOST}:{Config.API_PORT}/docs")
    print(f"ℹ️  Info: http://{Config.API_HOST}:{Config.API_PORT}/api/info")
    print("="*80 + "\n")

    uvicorn.run(
        "app:app",
        host=Config.API_HOST,
        port=Config.API_PORT,
        workers=Config.API_WORKERS,
        log_level=Config.LOG_LEVEL.lower(),
        access_log=True,
        reload=Config.DEBUG
    )
