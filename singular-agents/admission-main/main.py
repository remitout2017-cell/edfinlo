"""
main.py - University scoring integrated version
Complete admission letter processing with scoring
"""

import shutil
import fitz  # PyMuPDF
import google.generativeai as genai
from utils import save_json, cleanup_files
from analyzers.university_scorer import UniversityScorer
from analyzers.admission_verifier import AdmissionLetterVerifier
from extractors.admission_extractor import AdmissionLetterExtractor
from preprocessor import ProductionImagePreprocessor
from session_manager import session_manager
from schemas import AdmissionLetterRecord, AdmissionLetter, DocumentInfo, DocumentType, VerificationResult
from config import Config
import time
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


class UniversityRankingFetcher:
    """Fetch university rankings using Google Search via Gemini"""

    def __init__(self):
        if Config.GEMINI_API_KEY:
            try:
                genai.configure(api_key=Config.GEMINI_API_KEY)
                print("✅ Google Search enabled for university rankings")
            except Exception as e:
                print(f"⚠️ Google Search configuration failed: {e}")
        else:
            print("⚠️ Google Search disabled (no GEMINI_API_KEY)")

    def fetch_ranking(self, university_name: str, country: Optional[str] = None) -> Dict[str, Any]:
        """Fetch university ranking using Gemini with Google Search"""
        if not university_name or not Config.GEMINI_API_KEY:
            print("  ⚠️ Skipping ranking fetch - no university name or API key")
            return {}

        print(f"\n🔍 Fetching ranking for: {university_name}")

        try:
            # ✅ FIXED: Use gemini-2.0-flash-001 instead of gemini-pro
            model = genai.GenerativeModel(
                model_name='gemini-2.0-flash-001',  # ✅ UPDATED MODEL
                generation_config={
                    "temperature": 0.1,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 1024,
                }
            )

            # Create search query
            search_query = f"{university_name} university world ranking 2024 2025 QS Times Higher Education US News"
            if country:
                search_query += f" {country}"

            prompt = f"""
Search for the latest university rankings for "{university_name}".

Find and extract the following information if available:
1. QS World University Ranking position and year
2. Times Higher Education (THE) World University Ranking position and year
3. US News Global University Ranking position and year
4. Country ranking if available
5. Year of the ranking data

Format your response as:
QS World Ranking: [number] (Year: [year])
THE World Ranking: [number] (Year: [year])
US News Ranking: [number] (Year: [year])
Country Ranking: [number] (Country: [name], Year: [year])

If you cannot find specific information, say "Not found".
"""

            response = model.generate_content(prompt)
            text = response.text
            print(f"  📊 Ranking results received")

            # Parse the response
            ranking_data = {
                "qs_world_ranking": None,
                "times_world_ranking": None,
                "us_news_ranking": None,
                "country_ranking": None,
                "ranking_year": 2024,
                "ranking_notes": text[:300] + "..." if len(text) > 300 else text
            }

            # Simple parsing logic
            lines = text.split('\n')
            for line in lines:
                line_lower = line.lower()

                # Parse QS ranking
                if 'qs' in line_lower and 'ranking' in line_lower:
                    try:
                        import re
                        numbers = re.findall(r'\d+', line)
                        if numbers:
                            ranking_data["qs_world_ranking"] = int(numbers[0])
                    except:
                        pass

                # Parse THE ranking
                elif ('the' in line_lower or 'times higher' in line_lower) and 'ranking' in line_lower:
                    try:
                        import re
                        numbers = re.findall(r'\d+', line)
                        if numbers:
                            ranking_data["times_world_ranking"] = int(
                                numbers[0])
                    except:
                        pass

                # Parse US News ranking
                elif 'us news' in line_lower and 'ranking' in line_lower:
                    try:
                        import re
                        numbers = re.findall(r'\d+', line)
                        if numbers:
                            ranking_data["us_news_ranking"] = int(numbers[0])
                    except:
                        pass

                # Parse year
                elif 'year:' in line_lower:
                    try:
                        import re
                        years = re.findall(r'\d{4}', line)
                        if years:
                            ranking_data["ranking_year"] = int(years[0])
                    except:
                        pass

            # Print what we found
            print(f"  ✅ Rankings parsed:")
            if ranking_data["qs_world_ranking"]:
                print(f"     • QS: #{ranking_data['qs_world_ranking']}")
            if ranking_data["times_world_ranking"]:
                print(f"     • THE: #{ranking_data['times_world_ranking']}")
            if ranking_data["us_news_ranking"]:
                print(f"     • US News: #{ranking_data['us_news_ranking']}")

            return ranking_data

        except Exception as e:
            print(f"⚠️ Ranking fetch error: {e}")
            return {}


class AdmissionLetterProcessor:
    """Main orchestrator - processes admission letters with university scoring"""

    def __init__(self, threshold_strength: str = "none"):
        """
        Args:
            threshold_strength: "none", "light", "medium", or "strong"
        """
        self.preprocessor = ProductionImagePreprocessor(
            target_width=Config.TARGET_IMAGE_WIDTH,
            use_threshold=True,
            threshold_strength=threshold_strength
        )
        self.extractor = AdmissionLetterExtractor()
        self.verifier = AdmissionLetterVerifier()
        self.ranking_fetcher = UniversityRankingFetcher()
        self.scorer = UniversityScorer()

        print("✅ Admission Letter Processor initialized with scoring")

    def process_documents(self, admission_letters: List[str]) -> AdmissionLetterRecord:
        """
        Process admission letter documents with university scoring

        Args:
            admission_letters: List of admission/offer letter PDFs/Images

        Returns:
            AdmissionLetterRecord with extracted data and scores
        """
        start_time = time.time()

        # Validate input
        if not admission_letters or len(admission_letters) == 0:
            raise ValueError(
                "❌ Admission letters are required! At least one must be provided.")

        # Create session
        session_id = session_manager.create_session()
        session_dir = session_manager.get_session_dir(session_id)

        print(f"\n{'='*70}")
        print(f"🎓 ADMISSION LETTER PROCESSING WITH SCORING")
        print(f"{'='*70}")
        print(f"📋 Session ID: {session_id}")
        print(f"📁 Documents to process: {len(admission_letters)}")
        print(f"🎯 Scoring: ENABLED")
        print(f"{'='*70}")

        # Initialize record
        record = AdmissionLetterRecord(session_id=session_id)

        try:
            all_admissions = []
            mandatory_count = 0

            # Process each admission letter
            print(f"\n📄 PROCESSING ADMISSION LETTERS")
            print(f"{'-'*40}")

            for i, file_path in enumerate(admission_letters):
                file_path = Path(file_path)
                print(
                    f"\n[{i+1}/{len(admission_letters)}] Processing: {file_path.name}")

                # Get document info
                doc_info = self._get_document_info(
                    str(file_path),
                    document_type=DocumentType.ADMISSION_LETTER,
                    is_mandatory=True
                )
                record.documents.append(doc_info)
                mandatory_count += 1

                # Process the document
                admissions = self._process_document(
                    str(file_path),
                    session_dir,
                    doc_index=i,
                    doc_type=DocumentType.ADMISSION_LETTER
                )

                if admissions:
                    for admission in admissions:
                        # Mark as having admission letter
                        admission.has_admission_letter = True
                        admission.source_document_type = DocumentType.ADMISSION_LETTER

                        # Fetch university ranking
                        if admission.university_name:
                            print(f"\n🌐 Fetching university ranking...")
                            ranking_data = self.ranking_fetcher.fetch_ranking(
                                admission.university_name,
                                admission.country
                            )

                            # Calculate university score
                            print(f"\n🎯 Calculating university score...")

                            # Prepare admission data for scoring
                            admission_dict = {
                                'university_name': admission.university_name,
                                'program_name': admission.program_name,
                                'degree_level': admission.degree_level,
                                'intake_term': admission.intake_term,
                                'intake_year': admission.intake_year,
                                'country': admission.country,
                                'tuition_fee': admission.tuition_fee,
                                'scholarship_mentioned': admission.scholarship_mentioned,
                                'scholarship_amount': admission.scholarship_amount,
                                'acceptance_deadline': admission.acceptance_deadline,
                                'enrollment_deadline': admission.enrollment_deadline,
                                'fee_payment_deadline': admission.fee_payment_deadline,
                                'student_id': admission.student_id,
                                'application_id': admission.application_id,
                                'conditional_admission': admission.conditional_admission,
                                'extraction_confidence': admission.extraction_confidence,
                                'has_admission_letter': admission.has_admission_letter,
                            }

                            # Calculate scores
                            university_scores = self.scorer.calculate_university_score(
                                admission_dict,
                                ranking_data
                            )

                            # Add scores to admission metadata
                            admission.extraction_metadata = {
                                'university_score': university_scores['overall_score'],
                                'risk_level': university_scores['risk_level'],
                                'strengths': university_scores['strengths'],
                                'issues': university_scores['issues'],
                                'score_breakdown': university_scores['score_breakdown'],
                                'ranking_data': ranking_data,
                                'scoring_summary': university_scores['scoring_summary']
                            }

                            # Add scoring summary to notes
                            if admission.notes:
                                admission.notes += f"\n\n{university_scores['scoring_summary']}"
                            else:
                                admission.notes = university_scores['scoring_summary']

                        all_admissions.append(admission)

                    print(
                        f"  ✅ Extracted {len(admissions)} admission(s) with scoring")
                else:
                    print(f"  ⚠️ No admission data extracted")
                    record.errors.append(
                        f"Failed to extract from: {file_path.name}")

            # Store all admissions
            record.admission_letters = all_admissions
            record.total_documents = mandatory_count
            record.mandatory_documents_count = mandatory_count
            record.optional_documents_count = 0

            # Check mandatory documents
            record.has_all_mandatory_documents = mandatory_count > 0
            if mandatory_count == 0:
                record.missing_mandatory_documents.append(
                    "Admission/Offer Letter")

            # Verify all admissions
            if all_admissions:
                print(f"\n🔍 VERIFYING ADMISSIONS")
                print(f"{'-'*40}")
                record.verifications = self.verifier.verify_multiple(
                    all_admissions)

                # Count valid admissions
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
            record.processing_time_seconds = round(time.time() - start_time, 2)

            # Determine status
            if not record.has_all_mandatory_documents:
                record.status = "failed"
                record.errors.append("Missing mandatory admission letters")
            elif record.valid_admissions > 0:
                record.status = "success"
            elif len(all_admissions) > 0:
                record.status = "partial"
            else:
                record.status = "failed"
                record.errors.append("No admission data extracted")

            # Print final summary
            self._print_processing_summary(record)

        except Exception as e:
            record.status = "failed"
            record.errors.append(str(e))
            print(f"\n❌ Processing failed: {e}")
            traceback.print_exc()

        finally:
            # Cleanup
            if Config.AUTO_CLEANUP:
                session_manager.cleanup_session(session_id)

        return record

    def _process_document(self, file_path: str, session_dir: Path,
                          doc_index: int = 0, doc_type: str = "admission_letter") -> List[AdmissionLetter]:
        """Process single admission document"""
        try:
            file_path_obj = Path(file_path)

            # Check file exists
            if not file_path_obj.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            # Create image directory
            image_dir = session_dir / f"doc_{doc_index}_{doc_type}_images"
            image_dir.mkdir(exist_ok=True)

            # Determine if it's an image or PDF
            if file_path_obj.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif']:
                print(f"  🖼️ Processing image file")
                # Copy image to session directory
                dest_path = image_dir / f"page_1{file_path_obj.suffix}"
                shutil.copy2(file_path, dest_path)
                images = [str(dest_path)]
            elif file_path_obj.suffix.lower() == '.pdf':
                print(f"  📄 Converting PDF to images")
                # Convert PDF to images
                images = self.preprocessor.convert_pdf_to_images(
                    file_path,
                    str(image_dir)
                )
            else:
                raise ValueError(
                    f"Unsupported file format: {file_path_obj.suffix}")

            if not images:
                raise ValueError(f"No images extracted from {file_path}")

            # Limit pages
            if len(images) > Config.MAX_PAGES_PER_DOCUMENT:
                print(
                    f"  ⚠️ Limiting to {Config.MAX_PAGES_PER_DOCUMENT} pages")
                images = images[:Config.MAX_PAGES_PER_DOCUMENT]

            # Preprocess images
            preprocessed_images = []
            for i, img_path in enumerate(images):
                print(f"  🛠️ Preprocessing page {i+1}/{len(images)}")
                try:
                    preprocessed = self.preprocessor.preprocess_image(img_path)
                    preprocessed_path = session_dir / \
                        f"doc_{doc_index}_page_{i+1}_preprocessed.jpg"
                    self.preprocessor.save_preprocessed_image(
                        preprocessed, str(preprocessed_path))
                    preprocessed_images.append(str(preprocessed_path))
                except Exception as e:
                    print(f"  ⚠️ Failed to preprocess page {i+1}: {e}")

            # Extract data using AI
            print(f"  🤖 Extracting data with AI...")
            admissions = self.extractor.extract_multiple(preprocessed_images)

            return admissions

        except Exception as e:
            print(f"❌ Document processing error: {e}")
            return []

    def _get_document_info(self, file_path: str, document_type: str = "admission_letter",
                           is_mandatory: bool = True) -> DocumentInfo:
        """Get document metadata"""
        path = Path(file_path)

        try:
            size_mb = path.stat().st_size / (1024 * 1024)

            # Get page count
            page_count = 1
            if path.suffix.lower() == '.pdf':
                try:
                    pdf = fitz.open(str(path))
                    page_count = len(pdf)
                    pdf.close()
                except:
                    page_count = 1

            # Calculate quality score
            quality_score = 0.5
            if size_mb > 0.5:  # Good size
                quality_score += 0.2
            if page_count <= 5:  # Reasonable length
                quality_score += 0.2
            if path.suffix.lower() in ['.pdf', '.jpg', '.jpeg', '.png']:  # Good format
                quality_score += 0.1

            return DocumentInfo(
                filename=path.name,
                path=str(path),
                extension=path.suffix.lower(),
                size_mb=round(size_mb, 2),
                page_count=page_count,
                quality_score=min(1.0, quality_score),
                document_type=document_type,
                is_mandatory=is_mandatory
            )

        except Exception as e:
            print(f"⚠️ Document info error: {e}")
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

    def _print_processing_summary(self, record: AdmissionLetterRecord):
        """Print processing summary"""
        print(f"\n{'='*70}")
        print(f"✅ PROCESSING COMPLETE")
        print(f"{'='*70}")
        print(f"📋 Summary for Session: {record.session_id}")
        print(f"   • Status: {record.status.upper()}")
        print(f"   • Documents Processed: {record.total_documents}")
        print(f"   • Admissions Extracted: {len(record.admission_letters)}")
        print(f"   • Valid Admissions: {record.valid_admissions}")
        print(
            f"   • Universities: {', '.join(record.universities) if record.universities else 'None'}")
        print(
            f"   • Countries: {', '.join(record.countries) if record.countries else 'None'}")
        print(f"   ⏱️ Processing Time: {record.processing_time_seconds}s")

        # Print scores if available
        if record.admission_letters:
            print(f"\n🎯 UNIVERSITY SCORES:")
            for i, admission in enumerate(record.admission_letters):
                if hasattr(admission, 'extraction_metadata') and admission.extraction_metadata:
                    score = admission.extraction_metadata.get(
                        'university_score', 0)
                    risk = admission.extraction_metadata.get(
                        'risk_level', 'medium')
                    print(
                        f"   [{i+1}] {admission.university_name or 'Unknown'}:")
                    print(f"       • Score: {score}/100")
                    print(f"       • Risk: {risk.upper()}")

        print(f"{'='*70}")


# ============================================================================
# TEST FUNCTION
# ============================================================================

def test_processor():
    """Test the admission processor with scoring"""
    print("🧪 TESTING ADMISSION PROCESSOR WITH SCORING")
    print("=" * 60)

    # Check configuration
    print("🔧 Checking configuration...")
    Config.validate()

    # Create processor
    processor = AdmissionLetterProcessor(threshold_strength="none")

    # Test with sample file (update path as needed)
    test_files = []

    # Check for test files in common locations
    test_locations = [
        "test_admission.pdf",
        "sample_admission_letter.pdf",
        "admission_letter.pdf",
        "examples/admission.pdf"
    ]

    for loc in test_locations:
        if Path(loc).exists():
            test_files.append(loc)
            break

    if not test_files:
        print("⚠️ No test files found. Please provide a test file path.")
        test_file = input("Enter path to test admission letter: ").strip()
        if test_file and Path(test_file).exists():
            test_files.append(test_file)
        else:
            print("❌ No valid test file provided.")
            return None

    print(f"📁 Using test file: {test_files[0]}")

    # Process documents
    try:
        result = processor.process_documents(test_files)

        # Save result
        output_data = result.model_dump(mode='json')
        save_json(output_data, "admission_processing_result.json")

        print(f"\n💾 Results saved to: admission_processing_result.json")

        # Display key results
        print(f"\n📊 KEY RESULTS:")
        print(f"   • Status: {result.status}")
        print(f"   • Valid Admissions: {result.valid_admissions}")

        if result.admission_letters:
            for i, admission in enumerate(result.admission_letters):
                print(f"\n   Admission {i+1}:")
                print(
                    f"      • University: {admission.university_name or 'N/A'}")
                print(f"      • Program: {admission.program_name or 'N/A'}")
                print(f"      • Country: {admission.country or 'N/A'}")

                if hasattr(admission, 'extraction_metadata') and admission.extraction_metadata:
                    score = admission.extraction_metadata.get(
                        'university_score', 0)
                    risk = admission.extraction_metadata.get(
                        'risk_level', 'medium')
                    print(f"      • University Score: {score}/100")
                    print(f"      • Risk Level: {risk}")

        return result

    except Exception as e:
        print(f"❌ Test failed: {e}")
        traceback.print_exc()
        return None


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("="*70)
    print("🎓 ADMISSION LETTER PROCESSOR WITH UNIVERSITY SCORING")
    print("="*70)

    # Run test
    result = test_processor()

    if result:
        print("\n✅ Test completed successfully!")
    else:
        print("\n❌ Test failed!")

    print("="*70)
