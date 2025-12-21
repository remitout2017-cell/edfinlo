"""
FastAPI Production API for Loan Approval AI
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
import os
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
from werkzeug.utils import secure_filename

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
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    engine = LoanApprovalEngine()
    logger.info("✅ API Ready")


def save_upload(file: UploadFile, session_id: str, prefix: str) -> str:
    """Save uploaded file"""
    filename = secure_filename(f"{session_id}_{prefix}_{file.filename}")
    filepath = Config.UPLOAD_DIR / filename
    
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
                logger.info(f"   🗑️  Deleted: {Path(filepath).name}")
        except Exception as e:
            logger.warning(f"   ⚠️  Could not delete {filepath}: {e}")


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "healthy",
        "service": "Loan Approval AI",
        "version": "3.0.0",
        "powered_by": "Gemini + LangChain",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "Loan Approval AI",
        "version": "3.0.0",
        "model": Config.GEMINI_MODEL,
        "vision_model": Config.GEMINI_VISION_MODEL,
        "capabilities": [
            "ITR extraction (2 years)",
            "Bank statement analysis (6 months)",
            "Salary slip extraction (3 months)",
            "FOIR calculation",
            "CIBIL score estimation",
            "Student loan eligibility"
        ],
        "processing": {
            "parallel_extraction": True,
            "multi_document_support": True,
            "max_processing_time": "60-120 seconds"
        },
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/analyze", response_model=dict)
async def analyze_loan_application(
    background_tasks: BackgroundTasks,
    salary_slips_pdf: UploadFile = File(..., description="Combined salary slips (3 months)"),
    bank_statement_pdf: UploadFile = File(..., description="Bank statement (6 months)"),
    itr_pdf_1: UploadFile = File(..., description="ITR document year 1"),
    itr_pdf_2: Optional[UploadFile] = File(None, description="ITR document year 2 (optional)"),
    form16_pdf: Optional[UploadFile] = File(None, description="Form 16 (optional)")
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
    - Student loan eligibility
    - Recommendations
    """
    session_id = create_session_id()
    start_time = datetime.now()
    
    logger.info(f"\n{'='*80}")
    logger.info(f"📤 NEW REQUEST - Session: {session_id}")
    logger.info(f"{'='*80}")
    
    uploaded_files = []
    
    try:
        # Save uploaded files
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
        logger.info("🔄 Processing loan application...")
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
            
            # Loan eligibility
            "student_loan": {
                "eligible": result.student_loan_eligible,
                "recommended_amount": result.recommended_loan_amount,
                "recommended_tenure_months": result.recommended_tenure_months
            },
            
            # Quality metrics
            "quality": {
                "overall_confidence": round(result.overall_confidence * 100, 2),
                "data_sources_used": result.data_sources_used,
                "missing_data": result.missing_data
            },
            
            # Issues and recommendations
            "critical_issues": result.critical_issues,
            "warnings": result.warnings,
            "recommendations": result.recommendations,
            
            # Documents processed
            "documents_processed": {
                "salary_slips": True,
                "bank_statement": True,
                "itr_1": True,
                "itr_2": itr_pdf_2 is not None,
                "form16": form16_pdf is not None
            }
        }
        
        return JSONResponse(status_code=200, content=response)
        
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


@app.get("/api/info")
async def api_info():
    """API information and usage"""
    return {
        "api_version": "3.0.0",
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
            "Student loan eligibility assessment",
            "Comprehensive recommendations"
        ],
        "processing": {
            "average_time": "60-120 seconds",
            "max_pdf_size": "50MB per file",
            "supported_formats": ["PDF"],
            "parallel_processing": True
        },
        "example_curl": """
curl -X POST "http://localhost:8000/api/analyze" \\
  -F "salary_slips_pdf=@salary_slips.pdf" \\
  -F "bank_statement_pdf=@bank_statement.pdf" \\
  -F "itr_pdf_1=@itr_2023_24.pdf" \\
  -F "itr_pdf_2=@itr_2022_23.pdf" \\
  -F "form16_pdf=@form16.pdf"
        """.strip()
    }


if __name__ == "__main__":
    print("\n" + "="*80)
    print("🚀 LOAN APPROVAL AI API v3.0")
    print("="*80)
    print("Powered by: Gemini + LangChain")
    print("Features:")
    print("  • Parallel document processing")
    print("  • FOIR calculation")
    print("  • CIBIL estimation")
    print("  • Student loan eligibility")
    print("="*80)
    print("🔗 API URL: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    print("ℹ️  Info: http://localhost:8000/api/info")
    print("="*80 + "\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )
