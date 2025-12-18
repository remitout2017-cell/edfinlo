import time
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime

from config import Config
from schemas import WorkExperienceRecord, WorkExperience, DocumentInfo, DocumentType
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
                          experience_letters: List[str],
                          offer_letters: Optional[List[str]] = None,
                          relieving_letters: Optional[List[str]] = None,
                          salary_slips: Optional[List[str]] = None,
                          other_documents: Optional[List[str]] = None) -> WorkExperienceRecord:
        """
        Process work experience documents

        Args:
            experience_letters: MANDATORY - List of experience letter PDFs
            offer_letters: OPTIONAL - List of offer letter PDFs
            relieving_letters: OPTIONAL - List of relieving letter PDFs
            salary_slips: OPTIONAL - List of salary slip PDFs
            other_documents: OPTIONAL - Any other supporting documents

        Returns:
            WorkExperienceRecord with all extracted data
        """
        start_time = time.time()

        # Validate mandatory documents
        if not experience_letters or len(experience_letters) == 0:
            raise ValueError(
                "❌ Experience letters are MANDATORY! At least one experience letter must be provided.")

        # Create session
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        print(f"\n{'='*70}")
        print(f"💼 PROCESSING WORK EXPERIENCE: {session_id}")
        print(f"{'='*70}")
        print(f"📋 Document Summary:")
        print(
            f"   ✅ Experience Letters (MANDATORY): {len(experience_letters)}")
        print(f"   📄 Offer Letters (Optional): {len(offer_letters or [])}")
        print(
            f"   📄 Relieving Letters (Optional): {len(relieving_letters or [])}")
        print(f"   💰 Salary Slips (Optional): {len(salary_slips or [])}")
        print(f"   📎 Other Documents (Optional): {len(other_documents or [])}")

        record = WorkExperienceRecord(session_id=session_id)

        try:
            all_work_experiences = []

            # Track document types
            mandatory_count = 0
            optional_count = 0

            # Process MANDATORY documents (Experience Letters)
            print(f"\n{'='*70}")
            print(f"🔴 PROCESSING MANDATORY DOCUMENTS (Experience Letters)")
            print(f"{'='*70}")

            for i, pdf_path in enumerate(experience_letters):
                print(
                    f"\n📄 Experience Letter {i+1}/{len(experience_letters)}: {Path(pdf_path).name}")

                doc_info = self._get_document_info(
                    pdf_path,
                    document_type=DocumentType.EXPERIENCE_LETTER,
                    is_mandatory=True
                )
                record.documents.append(doc_info)
                mandatory_count += 1

                # Process this document
                work_experiences = self._process_document(
                    pdf_path,
                    session_dir,
                    doc_index=i,
                    doc_type=DocumentType.EXPERIENCE_LETTER
                )

                if work_experiences:
                    # Mark these as having experience letter
                    for work_exp in work_experiences:
                        work_exp.has_experience_letter = True
                        work_exp.source_document_type = DocumentType.EXPERIENCE_LETTER

                    all_work_experiences.extend(work_experiences)
                    print(
                        f"   ✅ Extracted {len(work_experiences)} work experience(s)")
                else:
                    print(
                        f"   ⚠️ No work experience extracted from this experience letter")
                    record.errors.append(
                        f"Failed to extract from mandatory document: {Path(pdf_path).name}")

            # Process OPTIONAL documents
            optional_docs = [
                (offer_letters, DocumentType.OFFER_LETTER, "Offer Letters"),
                (relieving_letters, DocumentType.RELIEVING_LETTER, "Relieving Letters"),
                (salary_slips, DocumentType.SALARY_SLIP, "Salary Slips"),
                (other_documents, DocumentType.OTHER, "Other Documents")
            ]

            for doc_list, doc_type, doc_name in optional_docs:
                if doc_list and len(doc_list) > 0:
                    print(f"\n{'='*70}")
                    print(f"🟢 PROCESSING OPTIONAL DOCUMENTS ({doc_name})")
                    print(f"{'='*70}")

                    for i, pdf_path in enumerate(doc_list):
                        print(
                            f"\n📄 {doc_name} {i+1}/{len(doc_list)}: {Path(pdf_path).name}")

                        doc_info = self._get_document_info(
                            pdf_path,
                            document_type=doc_type,
                            is_mandatory=False
                        )
                        record.documents.append(doc_info)
                        optional_count += 1

                        # Process optional document
                        work_experiences = self._process_document(
                            pdf_path,
                            session_dir,
                            doc_index=len(record.documents) - 1,
                            doc_type=doc_type
                        )

                        if work_experiences:
                            for work_exp in work_experiences:
                                work_exp.source_document_type = doc_type
                            all_work_experiences.extend(work_experiences)
                            print(
                                f"   ✅ Extracted {len(work_experiences)} additional info")
                        else:
                            print(
                                f"   ℹ️ No additional data from this optional document")

            # Store all work experiences
            record.work_experiences = all_work_experiences
            record.total_documents = mandatory_count + optional_count
            record.mandatory_documents_count = mandatory_count
            record.optional_documents_count = optional_count

            # Check mandatory document requirement
            record.has_all_mandatory_documents = mandatory_count > 0
            if mandatory_count == 0:
                record.missing_mandatory_documents.append("Experience Letter")

            # Verify all work experiences
            if all_work_experiences:
                print(f"\n{'='*70}")
                print(f"🔍 VERIFICATION")
                print(f"{'='*70}")
                record.verifications = self.verifier.verify_multiple(
                    all_work_experiences)

                # Count valid experiences with mandatory documents
                record.valid_experiences = sum(
                    1 for i, v in enumerate(record.verifications)
                    if v.valid and all_work_experiences[i].has_experience_letter
                )

                # Calculate total years of experience
                record.total_years_experience = self._calculate_total_experience(
                    all_work_experiences
                )

            # Calculate processing time
            record.processing_time_seconds = time.time() - start_time

            # Determine status
            if not record.has_all_mandatory_documents:
                record.status = "failed"
                record.errors.append("Missing mandatory experience letters")
            elif record.valid_experiences > 0:
                record.status = "success"
            elif len(all_work_experiences) > 0:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append(
                    "No work experience extracted from any document")

            print(f"\n{'='*70}")
            print(f"✅ PROCESSING COMPLETE: {session_id}")
            print(f"{'='*70}")
            print(f"   Status: {record.status}")
            print(f"   📋 Documents:")
            print(
                f"      - Mandatory (Experience Letters): {record.mandatory_documents_count}")
            print(f"      - Optional: {record.optional_documents_count}")
            print(f"      - Total: {record.total_documents}")
            print(f"   💼 Work Experiences:")
            print(f"      - Extracted: {len(all_work_experiences)}")
            print(
                f"      - Valid (with experience letter): {record.valid_experiences}")
            if record.total_years_experience:
                print(
                    f"      - Total Experience: {record.total_years_experience:.1f} years")
            print(f"   ⏱️  Time: {record.processing_time_seconds:.2f}s")
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

    def _process_document(self, pdf_path: str, session_dir: Path,
                          doc_index: int = 0, doc_type: str = "other") -> List[WorkExperience]:
        """Process single work experience document"""
        try:
            # Convert PDF to images
            images = self.preprocessor.convert_pdf_to_images(
                pdf_path,
                str(session_dir / f"doc_{doc_index}_{doc_type}_images")
            )

            if not images:
                raise ValueError("No images extracted from PDF")

            # Limit pages
            if len(images) > Config.MAX_PAGES_PER_DOCUMENT:
                print(
                    f"   ⚠️ Document has {len(images)} pages, processing first {Config.MAX_PAGES_PER_DOCUMENT}")
                images = images[:Config.MAX_PAGES_PER_DOCUMENT]

            # Preprocess all pages
            preprocessed_images = []
            for i, img_path in enumerate(images):
                preprocessed = self.preprocessor.preprocess_image(img_path)
                preprocessed_path = session_dir / \
                    f"doc_{doc_index}_{doc_type}_page_{i+1}_preprocessed.jpg"
                self.preprocessor.save_preprocessed_image(
                    preprocessed, str(preprocessed_path))
                preprocessed_images.append(str(preprocessed_path))

            # Extract from all pages
            work_experiences = self.extractor.extract_multiple(
                preprocessed_images)

            return work_experiences

        except Exception as e:
            print(f"❌ Document processing error: {e}")
            return []

    def _get_document_info(self, pdf_path: str, document_type: str = "other",
                           is_mandatory: bool = False) -> DocumentInfo:
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
                quality_score=min(1.0, quality_score),
                document_type=document_type,
                is_mandatory=is_mandatory
            )

        except Exception as e:
            print(f"⚠️ Could not get document info: {e}")
            return DocumentInfo(
                filename=path.name,
                path=str(path),
                extension=path.suffix.lower(),
                size_mb=0,
                page_count=0,
                quality_score=0.3,
                document_type=document_type,
                is_mandatory=is_mandatory
            )

    def _calculate_total_experience(self, work_experiences: List[WorkExperience]) -> Optional[float]:
        """Calculate total years of work experience"""
        total_days = 0

        for work_exp in work_experiences:
            if not work_exp.start_date:
                continue

            try:
                # Parse start date
                start_day, start_month, start_year = map(
                    int, work_exp.start_date.split('/'))
                start_date = datetime(start_year, start_month, start_day)

                # Parse or use current date for end
                if work_exp.currently_working or not work_exp.end_date:
                    end_date = datetime.now()
                else:
                    end_day, end_month, end_year = map(
                        int, work_exp.end_date.split('/'))
                    end_date = datetime(end_year, end_month, end_day)

                # Calculate duration
                if end_date > start_date:
                    duration = (end_date - start_date).days
                    total_days += duration

            except Exception as e:
                print(
                    f"   ⚠️ Could not calculate duration for {work_exp.company_name}: {e}")
                continue

        if total_days > 0:
            total_years = total_days / 365.25
            return round(total_years, 1)

        return None


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    processor = WorkExperienceProcessor(threshold_strength="none")

    # NEW API: Separate mandatory and optional documents
    result = processor.process_documents(
        # MANDATORY - Experience letters (at least 1 required)
        experience_letters=[
            r"C:\project-version-1\testingdata\workexperiecnedata\Experience_Offer Letter Magicomeal .pdf",
            # r"C:\project-version-1\testingdata\work\experience_letter_2.pdf",
        ],

        # # OPTIONAL - Other documents
        # offer_letters=[
        #     r"C:\project-version-1\testingdata\work\offer_letter.pdf",
        # ],

        # relieving_letters=[
        #     r"C:\project-version-1\testingdata\work\relieving_letter.pdf",
        # ],

        # salary_slips=[
        #     r"C:\project-version-1\testingdata\work\salary_slip.pdf",
        # ],

        # other_documents=[
        #     r"path/to/any_other_document.pdf",
        # ]
    )

    # Save result
    output = result.model_dump(mode='json')
    save_json(output, "work_experience_record.json")

    print(f"\n💾 Results saved to: work_experience_record.json")

    # Print summary
    print(f"\n📊 FINAL SUMMARY:")
    print(f"   {'✅' if result.has_all_mandatory_documents else '❌'} Has Mandatory Documents: {result.has_all_mandatory_documents}")
    print(f"   📋 Mandatory Documents: {result.mandatory_documents_count}")
    print(f"   📄 Optional Documents: {result.optional_documents_count}")
    print(f"   💼 Work Experiences: {len(result.work_experiences)}")
    print(f"   ✅ Valid (with experience letter): {result.valid_experiences}")
    if result.total_years_experience:
        print(f"   📅 Total Experience: {result.total_years_experience} years")
    print(f"   ⏱️  Processing Time: {result.processing_time_seconds:.2f}s")
    print(f"   📊 Status: {result.status.upper()}")
