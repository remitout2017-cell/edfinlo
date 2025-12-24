"""
FastAPI Microservice - CRITICAL FIXES v6.2
✅ Fixed silent failures in extraction chains
✅ Better error logging and propagation
✅ Validation checks at each step
✅ Fallback responses for partial failures
"""
from schemas import (
    SalarySlipData, ITRData, BankStatementData,
    CIBILReportData, FOIRResult
)
from chains.foir_chain_groq import FOIRChainWithGroq
from chains.cibil_report_chain import CIBILReportChain
from chains.bank_chain import BankStatementChain
from chains.itr_chain import ITRChain
from chains.salary_chain import SalarySlipChain
from bank_metrics import compute_bank_metrics
from utils import save_json, create_session_id, setup_logging
from config import Config
from werkzeug.utils import secure_filename
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from contextlib import asynccontextmanager
import uvicorn
import logging
import sys
import os
import asyncio
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple

# Fix Windows console encoding
if sys.platform == "win32":
    try:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    except:
        pass

os.environ['PYTHONIOENCODING'] = 'utf-8'

# Setup logging with DEBUG level for troubleshooting
setup_logging("DEBUG")  # Changed from Config.LOG_LEVEL
logger = logging.getLogger(__name__)

# ============================================================================
# GLOBAL CHAIN INSTANCES (Singleton)
# ============================================================================
chains = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    # Startup
    global chains
    logger.info("🚀 Starting FOIR & CIBIL Microservice v6.2...")
    logger.info(f"   Environment: {Config.ENVIRONMENT}")
    logger.info(f"   Gemini Model: {Config.GEMINI_MODEL}")
    logger.info(f"   Groq Model: {Config.GROQ_MODEL}")
    logger.info(f"   Max File Size: {Config.MAX_FILE_SIZE_MB}MB")

    try:
        # ✅ Test API keys before initializing chains
        if not Config.GEMINI_API_KEY or len(Config.GEMINI_API_KEY) < 10:
            raise ValueError("Invalid GEMINI_API_KEY")
        if not Config.GROQ_API_KEY or len(Config.GROQ_API_KEY) < 10:
            raise ValueError("Invalid GROQ_API_KEY")

        logger.info("✅ API keys validated")

        chains['salary'] = SalarySlipChain()
        chains['itr'] = ITRChain()
        chains['bank'] = BankStatementChain()
        chains['cibil_report'] = CIBILReportChain()
        chains['foir'] = FOIRChainWithGroq()
        logger.info("✅ All chains initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize chains: {e}")
        logger.error(traceback.format_exc())
        raise

    yield  # App runs here

    # Shutdown
    logger.info("🛑 Shutting down microservice...")


# Initialize FastAPI
app = FastAPI(
    title="FOIR & CIBIL Extraction Microservice v6.2",
    description="Fast financial document extraction with Gemini + Groq",
    version="6.2.0",
    docs_url="/docs" if Config.DEBUG else None,
    redoc_url="/redoc" if Config.DEBUG else None,
    lifespan=lifespan
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


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def validate_pdf_file(file: UploadFile) -> Tuple[bool, Optional[str]]:
    """Validate uploaded PDF file"""
    if not file.filename:
        return False, "No filename provided"

    if not file.filename.lower().endswith('.pdf'):
        return False, "Only PDF files are allowed"

    try:
        content = file.file.read()
        file.file.seek(0)
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        return False, "Failed to read file"

    if len(content) > Config.MAX_FILE_SIZE_BYTES:
        return False, f"File too large. Max size: {Config.MAX_FILE_SIZE_MB}MB"

    if len(content) == 0:
        return False, "File is empty"

    if not content.startswith(b'%PDF'):
        return False, "Invalid PDF file format"

    return True, None


def save_upload(file: UploadFile, session_id: str, prefix: str) -> str:
    """Save uploaded file with validation"""
    is_valid, error = validate_pdf_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    filename = secure_filename(f"{session_id}_{prefix}_{file.filename}")
    filepath = Config.UPLOAD_DIR / filename

    # Path traversal protection
    try:
        resolved_path = filepath.resolve()
        upload_dir_resolved = Config.UPLOAD_DIR.resolve()
        if not str(resolved_path).startswith(str(upload_dir_resolved)):
            raise HTTPException(
                status_code=400,
                detail="Invalid filename - potential path traversal"
            )
    except Exception as e:
        logger.error(f"Path validation error: {e}")
        raise HTTPException(status_code=400, detail="Invalid file path")

    try:
        with open(filepath, "wb") as f:
            content = file.file.read()
            f.write(content)
        logger.info(f"   💾 Saved: {filename} ({len(content)} bytes)")
        return str(filepath)
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file")
    finally:
        try:
            file.file.seek(0)
        except:
            pass


def cleanup_files(filepaths: List[str]) -> None:
    """Delete temporary files"""
    for filepath in filepaths:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.debug(f"   🗑️ Deleted: {Path(filepath).name}")
        except Exception as e:
            logger.warning(f"   ⚠️ Could not delete {filepath}: {e}")


def calculate_confidence_score(scores: List[float]) -> float:
    """Calculate overall confidence from individual scores"""
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 2)


# ============================================================================
# ASYNC DOCUMENT PROCESSING WITH BETTER ERROR HANDLING
# ============================================================================

async def process_documents_parallel(
    salary_paths: List[str],
    itr_paths: List[str],
    bank_path: str,
    cibil_path: Optional[str] = None
) -> dict:
    """
    Process all documents in TRUE PARALLEL using asyncio.gather()
    ✅ FIXED: Better error handling and logging
    """
    logger.info("📊 [ASYNC] Processing all documents in parallel...")

    # ✅ Validate files exist before processing
    all_paths = salary_paths + itr_paths + [bank_path]
    if cibil_path:
        all_paths.append(cibil_path)

    for path in all_paths:
        if not os.path.exists(path):
            logger.error(f"❌ File not found: {path}")
            raise FileNotFoundError(f"File not found: {path}")
        logger.debug(f"✅ Validated file: {path}")

    # Create tasks for parallel execution
    tasks = {}

    try:
        # ✅ Salary processing with detailed error handling
        logger.info(
            f"   📄 Starting salary extraction from {len(salary_paths)} file(s)...")
        tasks['salary'] = asyncio.to_thread(
            chains['salary'].process,
            salary_paths[0] if len(salary_paths) == 1 else salary_paths
        )

        # ✅ ITR processing
        logger.info(
            f"   📄 Starting ITR extraction from {len(itr_paths)} file(s)...")
        tasks['itr'] = asyncio.to_thread(
            chains['itr'].process,
            itr_paths
        )

        # ✅ Bank processing (without employer name initially)
        logger.info(f"   📄 Starting bank statement extraction...")
        tasks['bank'] = asyncio.to_thread(
            chains['bank'].process,
            bank_path,
            None  # employer_name - we'll update later if needed
        )

        # Add CIBIL if provided
        if cibil_path:
            logger.info(f"   📄 Starting CIBIL report extraction...")
            tasks['cibil'] = asyncio.to_thread(
                chains['cibil_report'].process,
                cibil_path
            )

        # Execute all in parallel
        logger.info(
            f"   ⚡ Executing {len(tasks)} extraction tasks in parallel...")
        results = await asyncio.gather(
            *tasks.values(),
            return_exceptions=True
        )

    except Exception as e:
        logger.error(f"❌ Parallel processing setup failed: {e}")
        logger.error(traceback.format_exc())
        raise

    # Map results back with detailed logging
    result_keys = list(tasks.keys())
    processed = {}

    for i, key in enumerate(result_keys):
        if isinstance(results[i], Exception):
            logger.error(f"❌ {key.upper()} extraction FAILED:")
            logger.error(f"   Exception type: {type(results[i]).__name__}")
            logger.error(f"   Exception message: {str(results[i])}")
            logger.error(
                f"   Traceback: {traceback.format_exception(type(results[i]), results[i], results[i].__traceback__)}")
            processed[key] = None
        elif results[i] is None:
            logger.error(
                f"❌ {key.upper()} extraction returned None (silent failure)")
            processed[key] = None
        else:
            processed[key] = results[i]
            # ✅ Detailed success logging
            logger.info(f"✅ {key.upper()} extraction complete")
            if hasattr(results[i], 'extraction_confidence'):
                logger.info(
                    f"   Confidence: {results[i].extraction_confidence:.0%}")

            # Log key extracted data
            if key == 'salary' and results[i]:
                logger.info(f"   Employee: {results[i].employee_name}")
                logger.info(f"   Employer: {results[i].employer_name}")
                logger.info(
                    f"   Avg Net Salary: ₹{results[i].average_net_salary:,.2f}")
            elif key == 'itr' and results[i]:
                logger.info(f"   Taxpayer: {results[i].taxpayer_name}")
                logger.info(f"   Years Filed: {results[i].years_filed}")
                logger.info(
                    f"   Avg Annual Income: ₹{results[i].average_annual_income:,.2f}")
            elif key == 'bank' and results[i]:
                logger.info(
                    f"   Account Holder: {results[i].account_holder_name}")
                logger.info(f"   Bank: {results[i].bank_name}")
                logger.info(f"   Transactions: {len(results[i].transactions)}")
                logger.info(
                    f"   Avg Monthly EMI: ₹{results[i].average_monthly_emi:,.2f}")
            elif key == 'cibil' and results[i]:
                logger.info(f"   CIBIL Score: {results[i].cibil_score}")

    # ✅ Check if we have at least some data
    successful_extractions = [k for k, v in processed.items() if v is not None]
    failed_extractions = [k for k, v in processed.items() if v is None]

    logger.info(f"📊 Extraction Summary:")
    logger.info(
        f"   ✅ Successful: {', '.join(successful_extractions) if successful_extractions else 'None'}")
    logger.info(
        f"   ❌ Failed: {', '.join(failed_extractions) if failed_extractions else 'None'}")

    # ✅ Refine bank metrics with employer name (no race condition)
    if processed.get('salary') and processed.get('bank'):
        employer_name = processed['salary'].employer_name
        if employer_name:
            logger.info(
                f"🔄 Refining bank metrics with employer: {employer_name}")
            bank_data = processed['bank']

            if hasattr(bank_data, 'transactions') and bank_data.transactions:
                try:
                    # Recompute metrics
                    refined_metrics = compute_bank_metrics(
                        [t.model_dump() for t in bank_data.transactions],
                        employer_name=employer_name
                    )

                    # Create new instance instead of modifying existing
                    bank_dict = bank_data.model_dump()
                    bank_dict.update(refined_metrics)

                    processed['bank'] = BankStatementData(**bank_dict)
                    logger.info("✅ Bank metrics refined successfully")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to update bank metrics: {e}")
                    logger.warning(traceback.format_exc())
                    # Keep original bank_data

    return {
        'salary': processed.get('salary'),
        'itr': processed.get('itr'),
        'bank': processed.get('bank'),
        'cibil': processed.get('cibil')
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "healthy",
        "service": "FOIR & CIBIL Extraction Microservice",
        "version": "6.2.0",
        "powered_by": "Gemini + Groq + LangChain",
        "timestamp": datetime.now().isoformat(),
        "docs": "/docs" if Config.DEBUG else "Documentation disabled in production"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    try:
        if not chains:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy",
                         "error": "Chains not initialized"}
            )

        return {
            "status": "healthy",
            "service": "FOIR & CIBIL Microservice",
            "version": "6.2.0",
            "environment": Config.ENVIRONMENT,
            "models": {
                "gemini": Config.GEMINI_MODEL,
                "groq": Config.GROQ_MODEL
            },
            "capabilities": [
                "Parallel salary slip processing (1-3 PDFs)",
                "Parallel ITR processing (1-2 PDFs)",
                "CIBIL report extraction (optional)",
                "Bank statement analysis with EMI/salary detection",
                "Groq-powered FOIR calculation"
            ],
            "limits": {
                "max_file_size_mb": Config.MAX_FILE_SIZE_MB,
                "max_pdf_pages": Config.MAX_PDF_PAGES,
                "pdf_dpi": Config.PDF_DPI
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )


@app.post("/api/analyze")
async def analyze_financial_documents(
    background_tasks: BackgroundTasks,
    salary_slips_pdf: UploadFile = File(
        ..., description="Salary slip PDF (can contain 1-3 months)"),
    bank_statement_pdf: UploadFile = File(...,
                                          description="Bank statement PDF (6 months)"),
    itr_pdf_1: UploadFile = File(...,
                                 description="ITR PDF year 1 (most recent)"),
    itr_pdf_2: Optional[UploadFile] = File(
        None, description="ITR PDF year 2 (optional)"),
    cibil_pdf: Optional[UploadFile] = File(
        None, description="CIBIL report from GPay (optional)"),
    form16_pdf: Optional[UploadFile] = File(
        None, description="Form 16 (optional, not processed yet)")
):
    """
    Analyze financial documents with comprehensive error handling
    ✅ FIXED: Detailed logging at every step
    """
    session_id = create_session_id()
    start_time = time.time()

    logger.info(f"{'='*80}")
    logger.info(f"🔥 NEW REQUEST v6.2 - Session: {session_id}")
    logger.info(f"{'='*80}")

    uploaded_files = []
    errors = []

    try:
        if not chains:
            raise HTTPException(
                status_code=503,
                detail="Service not ready. Please try again."
            )

        # ====================================================================
        # STEP 1: Save uploaded files
        # ====================================================================
        logger.info("💾 Saving uploaded documents...")

        try:
            # Salary slips
            salary_paths = []
            salary_paths.append(save_upload(
                salary_slips_pdf, session_id, "salary"))
            uploaded_files.append(salary_paths[0])

            # ITR documents
            itr_paths = []
            itr_paths.append(save_upload(itr_pdf_1, session_id, "itr1"))
            uploaded_files.append(itr_paths[0])

            if itr_pdf_2:
                itr_paths.append(save_upload(itr_pdf_2, session_id, "itr2"))
                uploaded_files.append(itr_paths[1])

            # Bank statement
            bank_path = save_upload(bank_statement_pdf, session_id, "bank")
            uploaded_files.append(bank_path)

            # CIBIL report (optional)
            cibil_path = None
            if cibil_pdf:
                cibil_path = save_upload(cibil_pdf, session_id, "cibil")
                uploaded_files.append(cibil_path)

            # Form16 (optional, not processed but saved)
            if form16_pdf:
                form16_path = save_upload(form16_pdf, session_id, "form16")
                uploaded_files.append(form16_path)
                logger.info(
                    "   ℹ️ Form16 saved but not processed in this version")

            logger.info("   ✅ All documents saved successfully")

        except Exception as e:
            logger.error(f"❌ File upload failed: {e}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=400, detail=f"File upload failed: {str(e)}")

        # ====================================================================
        # STEP 2: Process documents in parallel
        # ====================================================================
        logger.info("🔄 Processing documents in parallel...")

        try:
            extracted = await process_documents_parallel(
                salary_paths=salary_paths,
                itr_paths=itr_paths,
                bank_path=bank_path,
                cibil_path=cibil_path
            )

            salary_data = extracted['salary']
            itr_data = extracted['itr']
            bank_data = extracted['bank']
            cibil_data = extracted['cibil']

            # ✅ Check if we got ANY data
            if not any([salary_data, itr_data, bank_data]):
                logger.error("❌ ALL extractions failed - no data extracted")
                errors.append(
                    "All document extractions failed. Please check PDF quality and try again.")

        except Exception as e:
            logger.error(f"❌ Document processing failed: {e}")
            logger.error(traceback.format_exc())
            errors.append(f"Document processing error: {str(e)}")
            salary_data = None
            itr_data = None
            bank_data = None
            cibil_data = None

        # ====================================================================
        # STEP 3: Calculate FOIR using Groq
        # ====================================================================
        logger.info("💵 Calculating FOIR...")
        foir_result = None

        if any([salary_data, itr_data, bank_data]):
            try:
                foir_result = chains['foir'].calculate_foir(
                    salary_data=salary_data,
                    itr_data=itr_data,
                    bank_data=bank_data
                )

                if foir_result:
                    logger.info(f"✅ FOIR: {foir_result.foir_percentage}%")
                else:
                    logger.warning("⚠️ FOIR calculation returned None")
                    errors.append("FOIR calculation failed")

            except Exception as e:
                logger.error(f"❌ FOIR calculation failed: {e}")
                logger.error(traceback.format_exc())
                errors.append(f"FOIR calculation error: {str(e)}")
        else:
            logger.warning("⚠️ Skipping FOIR - no financial data available")
            errors.append("FOIR calculation skipped - insufficient data")

        # Schedule cleanup
        background_tasks.add_task(cleanup_files, uploaded_files)

        # ====================================================================
        # STEP 4: Build response
        # ====================================================================
        processing_time = time.time() - start_time

        # Calculate confidence scores
        confidence_scores = []
        data_sources_used = []
        missing_data = []

        if salary_data:
            confidence_scores.append(salary_data.extraction_confidence)
            data_sources_used.append("Salary Slips")
        else:
            missing_data.append("Salary Slips")

        if itr_data:
            confidence_scores.append(itr_data.extraction_confidence)
            data_sources_used.append("ITR Documents")
        else:
            missing_data.append("ITR Documents")

        if bank_data:
            confidence_scores.append(bank_data.extraction_confidence)
            data_sources_used.append("Bank Statement")
        else:
            missing_data.append("Bank Statement")

        if cibil_data:
            confidence_scores.append(cibil_data.extraction_confidence)
            data_sources_used.append("CIBIL Report")

        overall_confidence = calculate_confidence_score(confidence_scores)

        # Determine status
        if not any([salary_data, itr_data, bank_data]):
            status = "failed"
        elif missing_data:
            status = "partial"
        else:
            status = "success"

        # Build response
        response = {
            "status": status,
            "session_id": session_id,
            "processing_time_seconds": round(processing_time, 2),
            "timestamp": datetime.now().isoformat(),

            # Extracted data
            "extracted_data": {
                "salary_slips": salary_data.model_dump(mode='json') if salary_data else None,
                "itr": itr_data.model_dump(mode='json') if itr_data else None,
                "cibil_report": cibil_data.model_dump(mode='json') if cibil_data else None,
                "bank_statement": bank_data.model_dump(mode='json') if bank_data else None
            },

            # FOIR calculation
            "foir": foir_result.model_dump(mode='json') if foir_result else None,

            # CIBIL score
            "cibil_score": cibil_data.cibil_score if cibil_data else None,

            # Quality metrics
            "quality": {
                "overall_confidence": overall_confidence,
                "data_sources_used": data_sources_used,
                "missing_data": missing_data
            },

            # Errors
            "errors": errors,

            # Documents processed
            "documents_processed": {
                "salary_slips": len(salary_paths),
                "itr_documents": len(itr_paths),
                "cibil_report": cibil_path is not None,
                "bank_statement": True
            }
        }

        # Save result to file
        result_path = Config.RESULTS_DIR / f"analysis_{session_id}.json"
        save_json(response, str(result_path))

        logger.info(f"✅ REQUEST COMPLETE - {processing_time:.2f}s")
        logger.info(f"   Status: {status}")
        logger.info(f"   Confidence: {overall_confidence:.0%}")
        if errors:
            logger.warning(f"   Errors: {len(errors)}")
        logger.info(f"{'='*80}")

        return JSONResponse(status_code=200, content=response)

    except HTTPException as he:
        cleanup_files(uploaded_files)
        raise he

    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR: {e}", exc_info=True)
        logger.error(traceback.format_exc())
        cleanup_files(uploaded_files)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "session_id": session_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "timestamp": datetime.now().isoformat(),
                "errors": errors
            }
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": "Internal server error",
            "detail": str(exc) if Config.DEBUG else "An error occurred"
        }
    )


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*80)
    print("🚀 FOIR & CIBIL EXTRACTION MICROSERVICE v6.2 (DEBUG MODE)")
    print("="*80)
    print(f"Environment: {Config.ENVIRONMENT}")
    print(f"Gemini Model: {Config.GEMINI_MODEL}")
    print(f"Groq Model: {Config.GROQ_MODEL}")
    print("\n✨ Critical Fixes Applied:")
    print("   ✅ Enhanced error logging and propagation")
    print("   ✅ Validation checks at each processing step")
    print("   ✅ Detailed extraction result logging")
    print("   ✅ Better exception handling with tracebacks")
    print("="*80)
    print(f"🔗 API URL: http://{Config.API_HOST}:{Config.API_PORT}")
    print(f"📖 Docs: http://{Config.API_HOST}:{Config.API_PORT}/docs")
    print("="*80 + "\n")

    uvicorn.run(
        "app:app",
        host=Config.API_HOST,
        port=Config.API_PORT,
        workers=1,
        log_level="debug",  # Changed to debug
        access_log=True,
        reload=Config.DEBUG
    )
