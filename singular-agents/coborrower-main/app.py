from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import uuid
import time
import logging
from pathlib import Path
from typing import Optional
from werkzeug.utils import secure_filename

from main import calculate_foir_cibil
from utils import save_json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="FOIR + CIBIL Calculator API",
    description="Fast, cheap, production-ready FOIR and CIBIL estimation",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)


def save_upload(file: UploadFile, prefix: str) -> str:
    """Save uploaded file and return path"""
    filename = secure_filename(f"{prefix}_{file.filename}")
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(file.file.read())

    logger.info(f"✅ Saved: {filename}")
    return str(filepath)


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "healthy",
        "service": "FOIR + CIBIL Calculator",
        "version": "2.0.0",
        "architecture": "4-document system"
    }


@app.post("/api/calculate")
async def calculate(
    salary_slips_pdf: UploadFile = File(
        ..., description="Single PDF containing last 3 months salary slips"),
    itr_documents_pdf: UploadFile = File(
        ..., description="Single PDF containing last 2 years ITR documents"),
    bank_statement_pdf: UploadFile = File(
        ..., description="Single PDF containing last 6 months bank statement"),
    form16_pdf: Optional[UploadFile] = File(
        None, description="Optional: Single PDF containing last 2 years Form 16")
):
    """
    Calculate FOIR and CIBIL with simplified 4-document architecture

    **Required Documents (3):**
    1. **salary_slips_pdf**: Combined PDF with last 3 months of salary slips
    2. **itr_documents_pdf**: Combined PDF with last 2 years of ITR returns
    3. **bank_statement_pdf**: Combined PDF with last 6 months bank statement

    **Optional Document (1):**
    4. **form16_pdf**: Combined PDF with last 2 years of Form 16

    **Returns:**
    - FOIR (Fixed Obligation to Income Ratio)
    - CIBIL Score Estimate
    - Processing metadata
    """

    start_time = time.time()
    session_id = str(uuid.uuid4())[:8]

    try:
        logger.info(f"\n{'='*70}")
        logger.info(f"📤 NEW SESSION: {session_id}")
        logger.info(f"{'='*70}")

        # Save uploaded files
        logger.info("💾 Saving uploaded documents...")

        # Save main documents
        salary_path = save_upload(
            salary_slips_pdf, f"{session_id}_salary_slips")
        itr_path = save_upload(itr_documents_pdf, f"{session_id}_itr_docs")
        bank_path = save_upload(
            bank_statement_pdf, f"{session_id}_bank_statement")

        # Save optional Form 16
        form16_path = None
        if form16_pdf:
            form16_path = save_upload(form16_pdf, f"{session_id}_form16")
            logger.info("✅ Form 16 included (optional)")
        else:
            logger.info("⚠️  Form 16 not provided (optional)")

        logger.info(f"\n✅ All documents saved for session: {session_id}")

        # Prepare document lists for processing
        # Note: Single PDF may contain multiple pages/documents
        salary_slips = [salary_path]  # Will be split internally if needed
        itr_docs = [itr_path]  # Will be split internally if needed

        # Add Form 16 to ITR documents if provided (for cross-validation)
        if form16_path:
            itr_docs.append(form16_path)

        # Calculate FOIR + CIBIL
        logger.info("\n🔄 Starting FOIR + CIBIL calculation...")
        result = calculate_foir_cibil(
            salary_slips=salary_slips,
            bank_statement=bank_path,
            itr_docs=itr_docs
        )

        # Save result
        output_file = RESULTS_DIR / f"foir_cibil_{session_id}.json"
        save_json(result.model_dump(mode='json'), str(output_file))

        # Cleanup uploaded files
        logger.info("\n🧹 Cleaning up temporary files...")
        files_to_cleanup = [salary_path, itr_path, bank_path]
        if form16_path:
            files_to_cleanup.append(form16_path)

        for path in files_to_cleanup:
            try:
                os.remove(path)
                logger.info(f"   🗑️  Deleted: {Path(path).name}")
            except FileNotFoundError:
                logger.warning(f"   ⚠️  Already deleted: {path}")
            except PermissionError:
                logger.error(f"   ❌ Permission denied: {path}")
            except Exception as e:
                logger.error(f"   ❌ Error deleting {path}: {e}")

        processing_time = time.time() - start_time

        logger.info(f"\n{'='*70}")
        logger.info(
            f"✅ SESSION COMPLETE: {session_id} ({processing_time:.2f}s)")
        logger.info(f"{'='*70}\n")

        # Build response
        response_data = {
            "status": "success",
            "session_id": session_id,
            "processing_time": round(processing_time, 2),
            "documents_processed": {
                "salary_slips": True,
                "itr_documents": True,
                "bank_statement": True,
                "form16": form16_path is not None
            },
            "result": {}
        }

        # Add FOIR results
        if result.foir:
            response_data["result"]["foir"] = {
                "percentage": result.foir.foir,
                "monthly_income": result.foir.monthly_income,
                "monthly_emi": result.foir.monthly_emi,
                "available_income": result.foir.available_income,
                "status": result.foir.status
            }
        else:
            response_data["result"]["foir"] = None
            response_data["warnings"] = response_data.get("warnings", [])
            response_data["warnings"].append("FOIR calculation failed")

        # Add CIBIL results
        if result.cibil:
            response_data["result"]["cibil"] = {
                "estimated_band": result.cibil.estimated_band,
                "estimated_score": result.cibil.estimated_score,
                "risk_level": result.cibil.risk_level,
                "insights": result.cibil.insights
            }
        else:
            response_data["result"]["cibil"] = None
            response_data["warnings"] = response_data.get("warnings", [])
            response_data["warnings"].append("CIBIL estimation failed")

        # Add extraction quality metadata
        if result.extraction_quality:
            response_data["extraction_quality"] = {
                "confidence": round(result.extraction_quality.confidence * 100, 2),
                "data_sources": result.extraction_quality.data_sources,
                "warnings": result.extraction_quality.warnings
            }

        return JSONResponse(
            status_code=200,
            content=response_data
        )

    except Exception as e:
        logger.error(
            f"\n❌ ERROR in session {session_id}: {str(e)}", exc_info=True)
        logger.error(f"{'='*70}\n")

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "session_id": session_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "processing_time": round(time.time() - start_time, 2)
            }
        )


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "FOIR + CIBIL Calculator",
        "version": "2.0.0",
        "architecture": {
            "document_count": "4 (3 required + 1 optional)",
            "documents": {
                "required": [
                    "salary_slips_pdf (last 3 months)",
                    "itr_documents_pdf (last 2 years)",
                    "bank_statement_pdf (last 6 months)"
                ],
                "optional": [
                    "form16_pdf (last 2 years)"
                ]
            }
        },
        "features": [
            "FOIR calculation (exact)",
            "CIBIL estimation (rule-based)",
            "Multi-page PDF support",
            "Cross-validation between documents",
            "Fast processing (<20s)"
        ],
        "cost_per_request": "₹0-5",
        "avg_processing_time": "10-20 seconds"
    }


@app.get("/api/info")
async def api_info():
    """API documentation and usage instructions"""
    return {
        "api_version": "2.0.0",
        "endpoint": "/api/calculate",
        "method": "POST",
        "content_type": "multipart/form-data",
        "required_documents": {
            "salary_slips_pdf": {
                "description": "Combined PDF containing last 3 months of salary slips",
                "format": "PDF",
                "pages": "Multiple pages allowed",
                "required": True
            },
            "itr_documents_pdf": {
                "description": "Combined PDF containing last 2 years of ITR documents",
                "format": "PDF",
                "pages": "Multiple pages allowed",
                "required": True
            },
            "bank_statement_pdf": {
                "description": "Combined PDF containing last 6 months bank statement",
                "format": "PDF",
                "pages": "Multiple pages allowed",
                "required": True
            },
            "form16_pdf": {
                "description": "Combined PDF containing last 2 years of Form 16",
                "format": "PDF",
                "pages": "Multiple pages allowed",
                "required": False,
                "note": "Helps improve accuracy through cross-validation"
            }
        },
        "response_format": {
            "foir": {
                "percentage": "float",
                "monthly_income": "float",
                "monthly_emi": "float",
                "available_income": "float",
                "status": "low/medium/high/critical"
            },
            "cibil": {
                "estimated_band": "string (e.g., 700-749)",
                "estimated_score": "integer (300-900)",
                "risk_level": "low/medium_low/medium/medium_high/high",
                "insights": "object with detailed analysis"
            }
        },
        "example_curl": """
curl -X POST "http://localhost:8000/api/calculate" \\
  -F "salary_slips_pdf=@salary_slips_3months.pdf" \\
  -F "itr_documents_pdf=@itr_2years.pdf" \\
  -F "bank_statement_pdf=@bank_statement_6months.pdf" \\
  -F "form16_pdf=@form16_2years.pdf"
        """.strip()
    }

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 FOIR + CIBIL Calculator API v2.0")
    print("="*70)
    print("📋 Architecture: 4-Document System")
    print("   1️⃣  Salary Slips PDF (3 months) - REQUIRED")
    print("   2️⃣  ITR Documents PDF (2 years) - REQUIRED")
    print("   3️⃣  Bank Statement PDF (6 months) - REQUIRED")
    print("   4️⃣  Form 16 PDF (2 years) - OPTIONAL")
    print("="*70)
    print("🔗 URL: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    print("ℹ️  Info: http://localhost:8000/api/info")
    print("="*70 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
