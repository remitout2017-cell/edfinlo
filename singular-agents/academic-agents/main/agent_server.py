# agent_server.py
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import uvicorn
from pathlib import Path
import time
import tempfile
import shutil
from datetime import datetime

from config import Config
from schemas import StudentAcademicRecord, Class10Marksheet, Class12Marksheet
from session_manager import session_manager
from preprocessor import ProductionImagePreprocessor
from extractors.class10_extractor import Class10Extractor
from extractors.class12_extractor import Class12Extractor
from extractors.graduation_extractor import GraduationExtractor
from analyzers.gap_analyzer import GapAnalyzer


app = FastAPI(
    title="Academic Records Extraction API",
    description="AI-powered Indian academic document processing",
    version="1.0.0"
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Node.js server URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize processors
preprocessor = ProductionImagePreprocessor(threshold_strength="none")
class10_extractor = Class10Extractor()
class12_extractor = Class12Extractor()
graduation_extractor = GraduationExtractor()
gap_analyzer = GapAnalyzer()


def save_upload_file(upload_file: UploadFile, destination: Path) -> Path:
    """Save uploaded file to temporary location"""
    try:
        with destination.open("wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        return destination
    finally:
        upload_file.file.close()


def process_single_document(pdf_file: UploadFile, doc_type: str, session_dir: Path):
    """Process a single document (10th or 12th)"""
    # Save uploaded file
    pdf_path = session_dir / f"{doc_type}.pdf"
    save_upload_file(pdf_file, pdf_path)

    # Convert PDF to images
    images = preprocessor.convert_pdf_to_images(
        str(pdf_path),
        str(session_dir / f"{doc_type}_images")
    )

    if not images:
        raise ValueError(f"No images extracted from {doc_type} PDF")

    # Preprocess first page
    preprocessed = preprocessor.preprocess_image(images[0])
    preprocessed_path = session_dir / f"{doc_type}_preprocessed.jpg"
    preprocessor.save_preprocessed_image(preprocessed, str(preprocessed_path))

    # Extract based on type
    if doc_type == "10th":
        return class10_extractor.extract(str(preprocessed_path))
    elif doc_type == "12th":
        return class12_extractor.extract(str(preprocessed_path))


@app.get("/")
async def root():
    return {
        "service": "Academic Records Extraction API",
        "status": "operational",
        "version": "1.0.0",
        "endpoints": {
            "class10": "/extract/class10",
            "class12": "/extract/class12",
            "complete": "/extract/complete"
        }
    }


@app.post("/extract/class10")
async def extract_class10(
    pdf_10th: UploadFile = File(..., description="Class 10 marksheet PDF")
):
    """Extract only Class 10 marksheet data"""
    start_time = time.time()
    session_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(session_id)

    try:
        print(f"📄 Processing Class 10 Marksheet - Session: {session_id}")

        result = process_single_document(pdf_10th, "10th", session_dir)

        if not result:
            raise HTTPException(
                status_code=422, detail="Failed to extract Class 10 data")

        response = {
            "success": True,
            "session_id": session_id,
            "processing_time_seconds": round(time.time() - start_time, 2),
            "data": result.model_dump(mode='json')
        }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if Config.AUTO_CLEANUP:
            session_manager.cleanup_session(session_id)


@app.post("/extract/class12")
async def extract_class12(
    pdf_12th: UploadFile = File(..., description="Class 12 marksheet PDF")
):
    """Extract only Class 12 marksheet data"""
    start_time = time.time()
    session_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(session_id)

    try:
        print(f"📄 Processing Class 12 Marksheet - Session: {session_id}")

        result = process_single_document(pdf_12th, "12th", session_dir)

        if not result:
            raise HTTPException(
                status_code=422, detail="Failed to extract Class 12 data")

        response = {
            "success": True,
            "session_id": session_id,
            "processing_time_seconds": round(time.time() - start_time, 2),
            "data": result.model_dump(mode='json')
        }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if Config.AUTO_CLEANUP:
            session_manager.cleanup_session(session_id)


@app.post("/extract/complete")
async def extract_complete(
    pdf_10th: Optional[UploadFile] = File(
        None, description="Class 10 marksheet PDF"),
    pdf_12th: Optional[UploadFile] = File(
        None, description="Class 12 marksheet PDF"),
    pdf_graduation: Optional[UploadFile] = File(
        None, description="Graduation marksheets PDF")
):
    """Extract complete academic record with gap analysis"""
    start_time = time.time()
    session_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(session_id)

    try:
        print(f"📄 Processing Complete Academic Record - Session: {session_id}")

        record = StudentAcademicRecord(student_id=session_id)

        # Process 10th
        if pdf_10th:
            record.class_10 = process_single_document(
                pdf_10th, "10th", session_dir)

        # Process 12th
        if pdf_12th:
            record.class_12 = process_single_document(
                pdf_12th, "12th", session_dir)

        # Process Graduation (multiple pages)
        if pdf_graduation:
            pdf_path = session_dir / "graduation.pdf"
            save_upload_file(pdf_graduation, pdf_path)

            images = preprocessor.convert_pdf_to_images(
                str(pdf_path),
                str(session_dir / "graduation_images")
            )

            if images:
                preprocessed_images = []
                for i, img_path in enumerate(images):
                    preprocessed = preprocessor.preprocess_image(img_path)
                    preprocessed_path = session_dir / \
                        f"graduation_page_{i+1}_preprocessed.jpg"
                    preprocessor.save_preprocessed_image(
                        preprocessed, str(preprocessed_path))
                    preprocessed_images.append(str(preprocessed_path))

                record.graduation = graduation_extractor.extract_multiple(
                    preprocessed_images)

        # Gap Analysis
        if record.class_10 or record.class_12 or record.graduation:
            record.gap_analysis = gap_analyzer.analyze_gaps(
                record.class_10,
                record.class_12,
                record.graduation
            )

        # Set status
        record.processing_time_seconds = time.time() - start_time

        if record.class_10 and record.class_12 and record.graduation:
            record.status = "success"
        elif record.class_10 or record.class_12 or record.graduation:
            record.status = "partial"
        else:
            record.status = "failed"
            record.errors.append("No data extracted from any document")

        response = {
            "success": True,
            "session_id": session_id,
            "processing_time_seconds": round(record.processing_time_seconds, 2),
            "data": record.model_dump(mode='json')
        }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if Config.AUTO_CLEANUP:
            session_manager.cleanup_session(session_id)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "gemini_configured": bool(Config.GEMINI_API_KEY),
            "groq_configured": bool(Config.GROQ_API_KEY)
        }
    }

if __name__ == "__main__":
    print("🚀 Starting Academic Records Extraction API Server")
    print(f"📍 Server will be available at: http://localhost:8000")
    print(f"📚 API Documentation: http://localhost:8000/docs")

    uvicorn.run(
        "agent_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
