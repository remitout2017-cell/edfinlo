import time
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

from config import Config
from schemas import StudentAcademicRecord
from session_manager import session_manager
from preprocessor import ProductionImagePreprocessor
from extractors.class10_extractor import Class10Extractor
from extractors.class12_extractor import Class12Extractor
from extractors.graduation_extractor import GraduationExtractor
from extractors.certificate_extractor import CertificateExtractor
from analyzers.gap_analyzer import GapAnalyzer
from utils import cleanup_files, save_json, list_images_in_folder


class AcademicRecordProcessor:
    """Main orchestrator - processes student academic records"""

    def __init__(self, threshold_strength: str = "none"):
        """
        Args:
            threshold_strength: "none", "light", "medium", or "strong"
                - "none": No threshold (RECOMMENDED for AI - preserves all details)
                - "light": Light threshold (keeps more gray tones)
                - "medium": Adaptive threshold (good for varying lighting)
                - "strong": Otsu threshold (original aggressive binarization)
        """
        self.preprocessor = ProductionImagePreprocessor(
            threshold_strength=threshold_strength)
        self.class10_extractor = Class10Extractor()
        self.class12_extractor = Class12Extractor()
        self.graduation_extractor = GraduationExtractor()
        self.certificate_extractor = CertificateExtractor()
        self.gap_analyzer = GapAnalyzer()

    def process_student(self,
                        pdf_10th: Optional[str] = None,
                        pdf_12th: Optional[str] = None,
                        pdf_graduation: Optional[str] = None,
                        pdf_certificates: Optional[str] = None) -> StudentAcademicRecord:
        """
        Process a student's academic records

        Args:
            pdf_10th: Path to 10th marksheet PDF
            pdf_12th: Path to 12th marksheet PDF
            pdf_graduation: Path to graduation marksheet PDF (can have multiple pages)
            pdf_certificates: Path to certificates PDF (can have multiple pages)

        Returns:
            StudentAcademicRecord with all extracted data
        """
        start_time = time.time()

        # Create session
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        print(f"\n{'='*70}")
        print(f"🎓 PROCESSING STUDENT: {session_id}")
        print(f"{'='*70}")

        record = StudentAcademicRecord(student_id=session_id)

        try:
            # Process 10th
            if pdf_10th:
                record.class_10 = self._process_10th(pdf_10th, session_dir)

            # Process 12th
            if pdf_12th:
                record.class_12 = self._process_12th(pdf_12th, session_dir)

            # Process Graduation
            if pdf_graduation:
                record.graduation = self._process_graduation(
                    pdf_graduation, session_dir)

            # Process Certificates
            if pdf_certificates:
                record.certificates = self._process_certificates(
                    pdf_certificates, session_dir)

            # Gap Analysis
            if record.class_10 or record.class_12 or record.graduation:
                record.gap_analysis = self.gap_analyzer.analyze_gaps(
                    record.class_10,
                    record.class_12,
                    record.graduation
                )

            # Calculate processing time
            record.processing_time_seconds = time.time() - start_time

            # Determine status
            if record.class_10 and record.class_12 and record.graduation:
                record.status = "success"
            elif record.class_10 or record.class_12 or record.graduation:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append("No data extracted from any document")

            print(f"\n{'='*70}")
            print(f"✅ PROCESSING COMPLETE: {session_id}")
            print(f"   Status: {record.status}")
            print(f"   Time: {record.processing_time_seconds:.2f}s")
            print(f"{'='*70}")

        except Exception as e:
            record.status = "failed"
            record.errors.append(str(e))
            print(f"\n❌ Processing failed: {e}")

        finally:
            # Cleanup temporary files
            if Config.AUTO_CLEANUP:
                session_manager.cleanup_session(session_id)

        return record

    def _process_10th(self, pdf_path: str, session_dir: Path):
        """Process 10th marksheet"""
        print(f"\n📄 Processing 10th Marksheet...")

        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / "10th_images")
            )

            if not images:
                raise ValueError("No images extracted from 10th PDF")

            # Preprocess first page
            preprocessed = self.preprocessor.preprocess_image(images[0])
            preprocessed_path = session_dir / "10th_preprocessed.jpg"
            self.preprocessor.save_preprocessed_image(
                preprocessed, str(preprocessed_path))

            # Extract data
            result = self.class10_extractor.extract(str(preprocessed_path))

            return result

        except Exception as e:
            print(f"❌ 10th processing error: {e}")
            return None

    def _process_12th(self, pdf_path: str, session_dir: Path):
        """Process 12th marksheet"""
        print(f"\n📄 Processing 12th Marksheet...")

        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / "12th_images")
            )

            if not images:
                raise ValueError("No images extracted from 12th PDF")

            # Preprocess first page
            preprocessed = self.preprocessor.preprocess_image(images[0])
            preprocessed_path = session_dir / "12th_preprocessed.jpg"
            self.preprocessor.save_preprocessed_image(
                preprocessed, str(preprocessed_path))

            # Extract data
            result = self.class12_extractor.extract(str(preprocessed_path))

            return result

        except Exception as e:
            print(f"❌ 12th processing error: {e}")
            return None

    def _process_graduation(self, pdf_path: str, session_dir: Path):
        """Process graduation marksheets (multiple pages)"""
        print(f"\n📄 Processing Graduation Marksheets...")

        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / "graduation_images")
            )

            if not images:
                raise ValueError("No images extracted from graduation PDF")

            # Preprocess all pages
            preprocessed_images = []
            for i, img_path in enumerate(images):
                preprocessed = self.preprocessor.preprocess_image(img_path)
                preprocessed_path = session_dir / \
                    f"graduation_page_{i+1}_preprocessed.jpg"
                self.preprocessor.save_preprocessed_image(
                    preprocessed, str(preprocessed_path))
                preprocessed_images.append(str(preprocessed_path))

            # Extract from all pages
            result = self.graduation_extractor.extract_multiple(
                preprocessed_images)

            return result

        except Exception as e:
            print(f"❌ Graduation processing error: {e}")
            return None

    def _process_certificates(self, pdf_path: str, session_dir: Path):
        """Process certificates (multiple pages)"""
        print(f"\n📄 Processing Certificates...")

        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / "certificate_images")
            )

            if not images:
                raise ValueError("No images extracted from certificates PDF")

            # Preprocess all pages
            preprocessed_images = []
            for i, img_path in enumerate(images):
                preprocessed = self.preprocessor.preprocess_image(img_path)
                preprocessed_path = session_dir / \
                    f"certificate_{i+1}_preprocessed.jpg"
                self.preprocessor.save_preprocessed_image(
                    preprocessed, str(preprocessed_path))
                preprocessed_images.append(str(preprocessed_path))

            # Extract all certificates
            result = self.certificate_extractor.extract_multiple(
                preprocessed_images)

            return result

        except Exception as e:
            print(f"❌ Certificate processing error: {e}")
            return None


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # CHOOSE YOUR THRESHOLD SETTING:
    # - "none" = No threshold (RECOMMENDED - best for AI vision models)
    # - "light" = Light threshold (preserves more detail)
    # - "medium" = Adaptive threshold (good balance)
    # - "strong" = Otsu threshold (original aggressive setting)

    processor = AcademicRecordProcessor(
        threshold_strength="none")  # ← CHANGE THIS

    # Test with your PDFs
    result = processor.process_student(
        pdf_10th=r"C:\project-version-1\testingdata\academicdata\10.pdf",
        pdf_12th=r"C:\project-version-1\testingdata\academicdata\12.pdf",
        pdf_graduation=r"C:\project-version-1\testingdata\academicdata\graduation.pdf",
        # pdf_certificates="path/to/certificates.pdf"  # Optional
    )

    # Save result as JSON (now with datetime handling)
    output = result.model_dump(mode='json')  # Handles datetime conversion
    save_json(output, "student_record.json")

    print(f"\n💾 Results saved to: student_record.json")
