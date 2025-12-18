import time
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from config import Config
from schemas import AdmissionLetterRecord, AdmissionLetter, DocumentInfo, DocumentType
from session_manager import session_manager
from preprocessor import ProductionImagePreprocessor
from extractors.admission_extractor import AdmissionLetterExtractor
from analyzers.admission_verifier import AdmissionLetterVerifier
from utils import cleanup_files, save_json
import shutil


class AdmissionLetterProcessor:
    """Main orchestrator - processes admission letter documents"""

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
        self.extractor = AdmissionLetterExtractor()
        self.verifier = AdmissionLetterVerifier()

    def process_documents(self,
                          admission_letters: List[str],
                          i20_documents: Optional[List[str]] = None,
                          coe_documents: Optional[List[str]] = None,
                          fee_receipts: Optional[List[str]] = None,
                          scholarship_letters: Optional[List[str]] = None,
                          other_documents: Optional[List[str]] = None) -> AdmissionLetterRecord:
        """
        Process admission letter documents

        Args:
            admission_letters: MANDATORY - List of admission/offer letter PDFs/Images
            i20_documents: OPTIONAL - List of I-20 documents (USA)
            coe_documents: OPTIONAL - List of COE documents
            fee_receipts: OPTIONAL - List of fee receipt PDFs
            scholarship_letters: OPTIONAL - List of scholarship letter PDFs
            other_documents: OPTIONAL - Any other supporting documents

        Returns:
            AdmissionLetterRecord with all extracted data
        """
        start_time = time.time()

        # Validate mandatory documents
        if not admission_letters or len(admission_letters) == 0:
            raise ValueError(
                "❌ Admission/Offer letters are MANDATORY! At least one must be provided.")

        # Create session
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        print(f"\n{'='*70}")
        print(f"🎓 PROCESSING ADMISSION LETTERS: {session_id}")
        print(f"{'='*70}")
        print(f"📋 Document Summary:")
        print(
            f"   ✅ Admission/Offer Letters (MANDATORY): {len(admission_letters)}")
        print(f"   📄 I-20 Documents (Optional): {len(i20_documents or [])}")
        print(f"   📄 COE Documents (Optional): {len(coe_documents or [])}")
        print(f"   💰 Fee Receipts (Optional): {len(fee_receipts or [])}")
        print(
            f"   🎖️ Scholarship Letters (Optional): {len(scholarship_letters or [])}")
        print(f"   🔎 Other Documents (Optional): {len(other_documents or [])}")

        record = AdmissionLetterRecord(session_id=session_id)

        try:
            all_admissions = []
            mandatory_count = 0
            optional_count = 0

            # Process MANDATORY documents (Admission/Offer Letters)
            print(f"\n{'='*70}")
            print(f"🔴 PROCESSING MANDATORY DOCUMENTS (Admission/Offer Letters)")
            print(f"{'='*70}")

            for i, file_path in enumerate(admission_letters):
                print(
                    f"\n📄 Admission Letter {i+1}/{len(admission_letters)}: {Path(file_path).name}")

                doc_info = self._get_document_info(
                    file_path,
                    document_type=DocumentType.ADMISSION_LETTER,
                    is_mandatory=True
                )
                record.documents.append(doc_info)
                mandatory_count += 1

                # Process this document
                admissions = self._process_document(
                    file_path,
                    session_dir,
                    doc_index=i,
                    doc_type=DocumentType.ADMISSION_LETTER
                )

                if admissions:
                    # Mark these as having admission letter
                    for admission in admissions:
                        admission.has_admission_letter = True
                        admission.source_document_type = DocumentType.ADMISSION_LETTER
                    all_admissions.extend(admissions)
                    print(f"   ✅ Extracted {len(admissions)} admission(s)")
                else:
                    print(f"   ⚠️ No admission data extracted from this letter")
                    record.errors.append(
                        f"Failed to extract from mandatory document: {Path(file_path).name}")

            # Process OPTIONAL documents
            optional_docs = [
                (i20_documents, DocumentType.I20, "I-20 Documents"),
                (coe_documents, DocumentType.COE, "COE Documents"),
                (fee_receipts, DocumentType.FEE_RECEIPT, "Fee Receipts"),
                (scholarship_letters, DocumentType.SCHOLARSHIP_LETTER,
                 "Scholarship Letters"),
                (other_documents, DocumentType.OTHER, "Other Documents")
            ]

            for doc_list, doc_type, doc_name in optional_docs:
                if doc_list and len(doc_list) > 0:
                    print(f"\n{'='*70}")
                    print(f"🟢 PROCESSING OPTIONAL DOCUMENTS ({doc_name})")
                    print(f"{'='*70}")

                    for i, file_path in enumerate(doc_list):
                        print(
                            f"\n📄 {doc_name} {i+1}/{len(doc_list)}: {Path(file_path).name}")

                        doc_info = self._get_document_info(
                            file_path,
                            document_type=doc_type,
                            is_mandatory=False
                        )
                        record.documents.append(doc_info)
                        optional_count += 1

                        # Process optional document
                        admissions = self._process_document(
                            file_path,
                            session_dir,
                            doc_index=len(record.documents) - 1,
                            doc_type=doc_type
                        )

                        if admissions:
                            for admission in admissions:
                                admission.source_document_type = doc_type
                            all_admissions.extend(admissions)
                            print(
                                f"   ✅ Extracted {len(admissions)} additional info")
                        else:
                            print(
                                f"   ℹ️ No additional data from this optional document")

            # Store all admissions
            record.admission_letters = all_admissions
            record.total_documents = mandatory_count + optional_count
            record.mandatory_documents_count = mandatory_count
            record.optional_documents_count = optional_count

            # Check mandatory document requirement
            record.has_all_mandatory_documents = mandatory_count > 0
            if mandatory_count == 0:
                record.missing_mandatory_documents.append(
                    "Admission/Offer Letter")

            # Verify all admissions
            if all_admissions:
                print(f"\n{'='*70}")
                print(f"🔍 VERIFICATION")
                print(f"{'='*70}")
                record.verifications = self.verifier.verify_multiple(
                    all_admissions)

                # Count valid admissions with mandatory documents
                record.valid_admissions = sum(
                    1 for i, v in enumerate(record.verifications)
                    if v.valid and all_admissions[i].has_admission_letter
                )

            # Extract unique universities and countries
            record.universities = list(set(
                a.university_name for a in all_admissions
                if a.university_name
            ))
            record.countries = list(set(
                a.country for a in all_admissions
                if a.country
            ))

            # Calculate processing time
            record.processing_time_seconds = time.time() - start_time

            # Determine status
            if not record.has_all_mandatory_documents:
                record.status = "failed"
                record.errors.append(
                    "Missing mandatory admission/offer letters")
            elif record.valid_admissions > 0:
                record.status = "success"
            elif len(all_admissions) > 0:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append(
                    "No admission data extracted from any document")

            print(f"\n{'='*70}")
            print(f"✅ PROCESSING COMPLETE: {session_id}")
            print(f"{'='*70}")
            print(f"   Status: {record.status.upper()}")
            print(f"   📋 Documents:")
            print(
                f"      - Mandatory (Admission Letters): {record.mandatory_documents_count}")
            print(f"      - Optional: {record.optional_documents_count}")
            print(f"      - Total: {record.total_documents}")
            print(f"   🎓 Admissions:")
            print(f"      - Extracted: {len(all_admissions)}")
            print(
                f"      - Valid (with admission letter): {record.valid_admissions}")
            if record.universities:
                print(
                    f"      - Universities: {', '.join(record.universities)}")
            if record.countries:
                print(f"      - Countries: {', '.join(record.countries)}")
            print(f"   ⏱️ Time: {record.processing_time_seconds:.2f}s")
            print(f"{'='*70}")

        except Exception as e:
            record.status = "failed"
            record.errors.append(str(e))
            print(f"\n❌ Processing failed: {e}")
            import traceback
            traceback.print_exc()

        finally:
            # Cleanup temporary files
            if Config.AUTO_CLEANUP:
                session_manager.cleanup_session(session_id)

        return record

    def _process_document(self, file_path: str, session_dir: Path,
                          doc_index: int = 0, doc_type: str = "other") -> List[AdmissionLetter]:
        """Process single admission document (PDF or Image)"""
        try:
            file_path = Path(file_path)

            # Check if it's an image or PDF
            if file_path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff']:
                print(f"   📸 Detected image file, copying to session...")
                # Copy image to session directory
                image_dir = session_dir / f"doc_{doc_index}_{doc_type}_images"
                image_dir.mkdir(exist_ok=True)
                dest_path = image_dir / "page_1.jpg"
                shutil.copy2(file_path, dest_path)
                images = [str(dest_path)]
            else:
                # Convert PDF to images
                print(f"   📄 Converting PDF to images...")
                images = self.preprocessor.convert_pdf_to_images(
                    str(file_path),
                    str(session_dir / f"doc_{doc_index}_{doc_type}_images")
                )

            if not images:
                raise ValueError("No images extracted from document")

            # Limit pages
            if len(images) > Config.MAX_PAGES_PER_DOCUMENT:
                print(
                    f"   ⚠️ Document has {len(images)} pages, processing first {Config.MAX_PAGES_PER_DOCUMENT}")
                images = images[:Config.MAX_PAGES_PER_DOCUMENT]

            print(f"   🖼️ Processing {len(images)} page(s)...")

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
            print(f"   🤖 Extracting data using AI...")
            admissions = self.extractor.extract_multiple(preprocessed_images)

            if not admissions:
                print(f"   ⚠️ AI extraction returned no results")
                print(f"   💡 Tip: Check if the image contains readable text")
                print(f"   💡 Tip: Verify your API keys are correct in .env file")

            return admissions

        except Exception as e:
            print(f"❌ Document processing error: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _get_document_info(self, file_path: str, document_type: str = "other",
                           is_mandatory: bool = False) -> DocumentInfo:
        """Get document metadata"""
        path = Path(file_path)

        try:
            size_mb = path.stat().st_size / (1024 * 1024)

            # Try to get page count for PDFs
            page_count = 1  # Default for images
            if path.suffix.lower() == '.pdf':
                import fitz
                try:
                    pdf = fitz.open(str(path))
                    page_count = len(pdf)
                    pdf.close()
                except:
                    page_count = 0

            # Simple quality score based on file size
            quality_score = 0.5
            if size_mb > 0.1:
                quality_score += 0.3
            if page_count > 0:
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


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("="*70)
    print("🎓 ADMISSION LETTER PROCESSOR")
    print("="*70)

    # Check API keys
    print("\n🔑 Checking API Keys...")
    if Config.GEMINI_API_KEY:
        print("   ✅ GEMINI_API_KEY found")
    else:
        print("   ⚠️ GEMINI_API_KEY not found")

    if Config.OPENROUTER_API_KEY:
        print("   ✅ OPENROUTER_API_KEY found")
    else:
        print("   ⚠️ OPENROUTER_API_KEY not found")

    if not Config.GEMINI_API_KEY and not Config.OPENROUTER_API_KEY:
        print("\n❌ ERROR: No API keys found!")
        print("Please add GEMINI_API_KEY or OPENROUTER_API_KEY to your .env file")
        exit(1)

    processor = AdmissionLetterProcessor(threshold_strength="none")

    # NEW API: Separate mandatory and optional documents
    result = processor.process_documents(
        # MANDATORY - Admission/Offer letters (at least 1 required)
        admission_letters=[
            r"C:\project-version-1\testingdata\workexperiecnedata\Screenshot 2025-12-01 155424.png",
        ],
    )

    # Save result
    output = result.model_dump(mode='json')
    save_json(output, "admission_letter_record.json")

    print(f"\n💾 Results saved to: admission_letter_record.json")

    # Print summary
    print(f"\n📊 FINAL SUMMARY:")
    print(f"   {'✅' if result.has_all_mandatory_documents else '❌'} Has Mandatory Documents: {result.has_all_mandatory_documents}")
    print(f"   📋 Mandatory Documents: {result.mandatory_documents_count}")
    print(f"   📄 Optional Documents: {result.optional_documents_count}")
    print(f"   🎓 Admissions: {len(result.admission_letters)}")
    print(f"   ✅ Valid (with admission letter): {result.valid_admissions}")
    if result.universities:
        print(f"   🏫 Universities: {', '.join(result.universities)}")
    if result.countries:
        print(f"   🌍 Countries: {', '.join(result.countries)}")
    print(f"   ⏱️ Processing Time: {result.processing_time_seconds:.2f}s")
    print(f"   📊 Status: {result.status.upper()}")

    if result.errors:
        print(f"\n❌ ERRORS:")
        for error in result.errors:
            print(f"   - {error}")
