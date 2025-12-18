import time
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from config import Config
from schemas import WorkExperienceRecord, WorkExperience, DocumentInfo
from session_manager import session_manager
from preprocessor import ProductionImagePreprocessor
from extractors.work_extractor import WorkExperienceExtractor
from analyzers.work_verifier import WorkExperienceVerifier
from utils import cleanup_files, save_json


class WorkExperienceProcessor:
    """Main orchestrator - processes work experience documents"""

    def __init__(self, threshold_strength: str = "none"):
        """
        Args:
            threshold_strength: "none", "light", "medium", or "strong"
                - "none": No threshold (RECOMMENDED for AI)
                - "light": Light threshold
                - "medium": Adaptive threshold
                - "strong": Otsu threshold
        """
        self.preprocessor = ProductionImagePreprocessor(
            threshold_strength=threshold_strength)
        self.extractor = WorkExperienceExtractor()
        self.verifier = WorkExperienceVerifier()

    def process_documents(self, 
                         pdf_paths: List[str]) -> WorkExperienceRecord:
        """
        Process work experience documents
        
        Args:
            pdf_paths: List of paths to work experience PDFs
        
        Returns:
            WorkExperienceRecord with all extracted data
        """
        start_time = time.time()

        # Create session
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        print(f"\n{'='*70}")
        print(f"💼 PROCESSING WORK EXPERIENCE: {session_id}")
        print(f"{'='*70}")

        record = WorkExperienceRecord(session_id=session_id)

        try:
            all_work_experiences = []
            
            # Process each document
            for i, pdf_path in enumerate(pdf_paths):
                print(f"\n📄 Processing Document {i+1}/{len(pdf_paths)}: {Path(pdf_path).name}")
                
                doc_info = self._get_document_info(pdf_path)
                record.documents.append(doc_info)
                
                # Process this document
                work_experiences = self._process_document(
                    pdf_path, 
                    session_dir,
                    doc_index=i
                )
                
                if work_experiences:
                    all_work_experiences.extend(work_experiences)
                    print(f"   ✅ Extracted {len(work_experiences)} work experience(s)")
                else:
                    print(f"   ⚠️ No work experience extracted from this document")
                    record.errors.append(f"Failed to extract from {Path(pdf_path).name}")

            # Store all work experiences
            record.work_experiences = all_work_experiences
            record.total_documents = len(pdf_paths)

            # Verify all work experiences
            if all_work_experiences:
                print(f"\n🔍 Verifying {len(all_work_experiences)} work experience entries...")
                record.verifications = self.verifier.verify_multiple(all_work_experiences)
                
                # Count valid experiences
                record.valid_experiences = sum(
                    1 for v in record.verifications if v.valid
                )
                
                # Calculate total years of experience
                record.total_years_experience = self._calculate_total_experience(
                    all_work_experiences
                )

            # Calculate processing time
            record.processing_time_seconds = time.time() - start_time

            # Determine status
            if record.valid_experiences > 0:
                record.status = "success"
            elif len(all_work_experiences) > 0:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append("No work experience extracted from any document")

            print(f"\n{'='*70}")
            print(f"✅ PROCESSING COMPLETE: {session_id}")
            print(f"   Status: {record.status}")
            print(f"   Documents: {record.total_documents}")
            print(f"   Extracted: {len(all_work_experiences)}")
            print(f"   Valid: {record.valid_experiences}")
            if record.total_years_experience:
                print(f"   Total Experience: {record.total_years_experience:.1f} years")
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

    def _process_document(self, pdf_path: str, session_dir: Path, doc_index: int = 0) -> List[WorkExperience]:
        """Process single work experience document"""
        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / f"doc_{doc_index}_images")
            )

            if not images:
                raise ValueError("No images extracted from PDF")

            # Limit pages
            if len(images) > Config.MAX_PAGES_PER_DOCUMENT:
                print(f"   ⚠️ Document has {len(images)} pages, processing first {Config.MAX_PAGES_PER_DOCUMENT}")
                images = images[:Config.MAX_PAGES_PER_DOCUMENT]

            # Preprocess all pages
            preprocessed_images = []
            for i, img_path in enumerate(images):
                preprocessed = self.preprocessor.preprocess_image(img_path)
                preprocessed_path = session_dir / f"doc_{doc_index}_page_{i+1}_preprocessed.jpg"
                self.preprocessor.save_preprocessed_image(
                    preprocessed, str(preprocessed_path))
                preprocessed_images.append(str(preprocessed_path))

            # Extract from all pages
            work_experiences = self.extractor.extract_multiple(preprocessed_images)

            return work_experiences

        except Exception as e:
            print(f"❌ Document processing error: {e}")
            return []

    def _get_document_info(self, pdf_path: str) -> DocumentInfo:
        """Get document metadata"""
        path = Path(pdf_path)
        
        try:
            size_mb = path.stat().st_size / (1024 * 1024)
            
            # Try to get page count
            import fitz
            try:
                pdf = fitz.open(pdf_path)
                page_count = len(pdf)
                pdf.close()
            except:
                page_count = 0
            
            # Simple quality score based on file size and pages
            quality_score = 0.5
            if size_mb > 0.5:
                quality_score += 0.3
            if page_count > 0 and page_count <= 10:
                quality_score += 0.2
            
            return DocumentInfo(
                filename=path.name,
                path=str(path),
                extension=path.suffix.lower(),
                size_mb=size_mb,
                page_count=page_count,
                quality_score=min(1.0, quality_score)
            )
        
        except Exception as e:
            print(f"⚠️ Could not get document info: {e}")
            return DocumentInfo(
                filename=path.name,
                path=str(path),
                extension=path.suffix.lower(),
                size_mb=0,
                page_count=0,
                quality_score=0.3
            )

    def _calculate_total_experience(self, work_experiences: List[WorkExperience]) -> Optional[float]:
        """Calculate total years of work experience"""
        total_days = 0
        
        for work_exp in work_experiences:
            if not work_exp.start_date:
                continue
            
            try:
                # Parse start date
                start_day, start_month, start_year = map(int, work_exp.start_date.split('/'))
                start_date = datetime(start_year, start_month, start_day)
                
                # Parse or use current date for end
                if work_exp.currently_working or not work_exp.end_date:
                    end_date = datetime.now()
                else:
                    end_day, end_month, end_year = map(int, work_exp.end_date.split('/'))
                    end_date = datetime(end_year, end_month, end_day)
                
                # Calculate duration
                if end_date > start_date:
                    duration = (end_date - start_date).days
                    total_days += duration
            
            except Exception as e:
                print(f"   ⚠️ Could not calculate duration for {work_exp.company_name}: {e}")
                continue
        
        if total_days > 0:
            total_years = total_days / 365.25
            return round(total_years, 1)
        
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

    processor = WorkExperienceProcessor(
        threshold_strength="none"  # ← CHANGE THIS
    )

    # Test with your work experience PDFs
    result = processor.process_documents(
        pdf_paths=[
            r"C:\project-version-1\testingdata\work_experience\experience_letter_1.pdf",
            r"C:\project-version-1\testingdata\work_experience\experience_letter_2.pdf",
            # Add more documents as needed
        ]
    )

    # Save result as JSON (now with datetime handling)
    output = result.model_dump(mode='json')  # Handles datetime conversion
    save_json(output, "work_experience_record.json")

    print(f"\n💾 Results saved to: work_experience_record.json")
    
    # Print summary
    print(f"\n📊 SUMMARY:")
    print(f"   Total Documents: {result.total_documents}")
    print(f"   Work Experiences Found: {len(result.work_experiences)}")
    print(f"   Valid Experiences: {result.valid_experiences}")
    if result.total_years_experience:
        print(f"   Total Experience: {result.total_years_experience} years")
    print(f"   Processing Time: {result.processing_time_seconds:.2f}s")
    print(f"   Status: {result.status}")