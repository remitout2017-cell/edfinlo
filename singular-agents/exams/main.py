from pathlib import Path
import time
import shutil
from typing import Optional
import fitz  # PyMuPDF

from config import Config
from schemas import TestScoreRecord, TestType
from session_manager import SessionManager
from preprocessor import ImagePreprocessor
from extractors.toefl_extractor import TOEFLExtractor
from extractors.gre_extractor import GREExtractor
from extractors.ielts_extractor import IELTSExtractor
from verifiers.toefl_verifier import TOEFLVerifier
# 🔴 FIX: Added missing imports
from verifiers.gre_verifier import GREVerifier
from verifiers.ielts_verifier import IELTSVerifier

session_manager = SessionManager()


class TestScoreProcessor:
    """Main processor for test score extraction"""

    def __init__(self):
        self.preprocessor = ImagePreprocessor()
        self.toefl_extractor = TOEFLExtractor()
        self.gre_extractor = GREExtractor()
        self.ielts_extractor = IELTSExtractor()
        self.toefl_verifier = TOEFLVerifier()
        self.gre_verifier = GREVerifier()      # ✅ Now works!
        self.ielts_verifier = IELTSVerifier()  # ✅ Now works!
        print("✅ Test Score Processor initialized")

    def process_document(self, file_path: str, test_type: TestType) -> TestScoreRecord:
        """Process a test score document"""
        start_time = time.time()
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        record = TestScoreRecord(session_id=session_id, test_type=test_type)

        try:
            file_path_obj = Path(file_path)
            record.document_filename = file_path_obj.name
            record.document_path = str(file_path)

            # Convert to images
            images = self._extract_images(file_path, session_dir)

            if not images:
                raise ValueError("No images extracted from document")

            # Preprocess
            preprocessed = []
            for i, img in enumerate(images):
                proc_path = session_dir / f"page_{i+1}_preprocessed.jpg"
                processed_img = self.preprocessor.preprocess_image(img)
                self.preprocessor.save_image(processed_img, str(proc_path))
                preprocessed.append(str(proc_path))

            # Extract based on test type
            if test_type == TestType.TOEFL:
                score = self.toefl_extractor.extract(preprocessed)
                record.toefl_score = score
                if score:
                    verification = self.toefl_verifier.verify(score)
                    record.is_verified = verification.valid
                    record.verification_issues = verification.issues
                    record.extraction_confidence = verification.confidence_score

            # 🟡 FIX: Added verification for GRE
            elif test_type == TestType.GRE:
                score = self.gre_extractor.extract(preprocessed)
                record.gre_score = score
                if score:
                    # ✅ Now properly verifies GRE scores
                    verification = self.gre_verifier.verify(score)
                    record.is_verified = verification.valid
                    record.verification_issues = verification.issues
                    record.extraction_confidence = verification.confidence_score
                else:
                    record.extraction_confidence = 0.0

            # 🟡 FIX: Added verification for IELTS
            elif test_type == TestType.IELTS:
                score = self.ielts_extractor.extract(preprocessed)
                record.ielts_score = score
                if score:
                    # ✅ Now properly verifies IELTS scores
                    verification = self.ielts_verifier.verify(score)
                    record.is_verified = verification.valid
                    record.verification_issues = verification.issues
                    record.extraction_confidence = verification.confidence_score
                else:
                    record.extraction_confidence = 0.0

            # Set status based on actual verification results
            if record.extraction_confidence >= 0.7:
                record.status = "success"
            elif record.extraction_confidence >= 0.4:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append("Low extraction confidence")

            record.processing_time_seconds = round(time.time() - start_time, 2)

        except Exception as e:
            record.status = "failed"
            record.errors.append(str(e))
            print(f"❌ Processing error: {e}")

        finally:
            if Config.AUTO_CLEANUP:
                session_manager.cleanup_session(session_id)

        return record

    def _extract_images(self, file_path: str, output_dir: Path) -> list:
        """Extract images from PDF or copy image file"""
        path = Path(file_path)

        if path.suffix.lower() == '.pdf':
            return self.preprocessor.convert_pdf_to_images(str(path), str(output_dir))
        elif path.suffix.lower() in ['.jpg', '.jpeg', '.png']:
            dest = output_dir / f"page_1{path.suffix}"
            shutil.copy2(path, dest)
            return [str(dest)]
        else:
            raise ValueError(f"Unsupported file type: {path.suffix}")
