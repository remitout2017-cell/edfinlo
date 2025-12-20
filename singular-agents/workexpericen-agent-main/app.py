from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from pathlib import Path
import time
from werkzeug.utils import secure_filename

from main import WorkExperienceProcessor
from utils import save_json

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path("temp_uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {'pdf'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_files(files, prefix="doc"):
    """Save uploaded files and return their paths"""
    saved_paths = []

    if not files:
        return saved_paths

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            timestamp = int(time.time())
            unique_filename = f"{prefix}_{timestamp}_{i}_{filename}"
            filepath = UPLOAD_FOLDER / unique_filename
            file.save(str(filepath))
            saved_paths.append(str(filepath))

    return saved_paths


def cleanup_uploaded_files(file_paths):
    """Delete uploaded files after processing"""
    for filepath in file_paths:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"⚠️ Could not delete {filepath}: {e}")


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Work Experience Extraction API",
        "version": "1.0.0"
    }), 200


@app.route('/process', methods=['POST'])
def process_documents():
    """
    Process work experience documents

    Expected form data:
    - experience_letters: List of PDF files (MANDATORY)
    - offer_letters: List of PDF files (OPTIONAL)
    - relieving_letters: List of PDF files (OPTIONAL)
    - salary_slips: List of PDF files (OPTIONAL)
    - other_documents: List of PDF files (OPTIONAL)
    - threshold_strength: String ("none", "light", "medium", "strong") - default: "none"
    """
    try:
        # Get threshold strength parameter
        threshold_strength = request.form.get('threshold_strength', 'none')

        # Validate threshold strength
        if threshold_strength not in ['none', 'light', 'medium', 'strong']:
            return jsonify({
                "error": "Invalid threshold_strength. Must be one of: none, light, medium, strong"
            }), 400

        # Get uploaded files
        experience_letters_files = request.files.getlist('experience_letters')
        offer_letters_files = request.files.getlist('offer_letters')
        relieving_letters_files = request.files.getlist('relieving_letters')
        salary_slips_files = request.files.getlist('salary_slips')
        other_documents_files = request.files.getlist('other_documents')

        # Validate mandatory documents
        if not experience_letters_files or len(experience_letters_files) == 0:
            return jsonify({
                "error": "experience_letters are MANDATORY! At least one experience letter must be provided."
            }), 400

        # Check if files are actually uploaded (not empty)
        if all(file.filename == '' for file in experience_letters_files):
            return jsonify({
                "error": "No experience letters uploaded. At least one experience letter is required."
            }), 400

        # Save uploaded files
        all_uploaded_files = []

        experience_letters_paths = save_uploaded_files(
            experience_letters_files, "exp_letter")
        all_uploaded_files.extend(experience_letters_paths)

        offer_letters_paths = save_uploaded_files(
            offer_letters_files, "offer_letter")
        all_uploaded_files.extend(offer_letters_paths)

        relieving_letters_paths = save_uploaded_files(
            relieving_letters_files, "relieving_letter")
        all_uploaded_files.extend(relieving_letters_paths)

        salary_slips_paths = save_uploaded_files(
            salary_slips_files, "salary_slip")
        all_uploaded_files.extend(salary_slips_paths)

        other_documents_paths = save_uploaded_files(
            other_documents_files, "other_doc")
        all_uploaded_files.extend(other_documents_paths)

        # Validate that we have at least experience letters
        if not experience_letters_paths:
            cleanup_uploaded_files(all_uploaded_files)
            return jsonify({
                "error": "No valid experience letter PDFs uploaded"
            }), 400

        print(f"\n{'='*70}")
        print(f"📥 API REQUEST RECEIVED")
        print(f"{'='*70}")
        print(f"Experience Letters: {len(experience_letters_paths)}")
        print(f"Offer Letters: {len(offer_letters_paths)}")
        print(f"Relieving Letters: {len(relieving_letters_paths)}")
        print(f"Salary Slips: {len(salary_slips_paths)}")
        print(f"Other Documents: {len(other_documents_paths)}")
        print(f"Threshold Strength: {threshold_strength}")
        print(f"{'='*70}")

        # Initialize processor
        processor = WorkExperienceProcessor(
            threshold_strength=threshold_strength)

        # Process documents
        result = processor.process_documents(
            experience_letters=experience_letters_paths,
            offer_letters=offer_letters_paths if offer_letters_paths else None,
            relieving_letters=relieving_letters_paths if relieving_letters_paths else None,
            salary_slips=salary_slips_paths if salary_slips_paths else None,
            other_documents=other_documents_paths if other_documents_paths else None
        )

        # Cleanup uploaded files
        cleanup_uploaded_files(all_uploaded_files)

        # Convert result to JSON
        output = result.model_dump(mode='json')

        print(f"\n✅ API REQUEST COMPLETED")
        print(f"Status: {result.status}")
        print(f"Valid Experiences: {result.valid_experiences}")
        print(f"Processing Time: {result.processing_time_seconds:.2f}s\n")

        return jsonify(output), 200

    except ValueError as e:
        # Cleanup any uploaded files on error
        if 'all_uploaded_files' in locals():
            cleanup_uploaded_files(all_uploaded_files)

        return jsonify({
            "error": str(e)
        }), 400

    except Exception as e:
        # Cleanup any uploaded files on error
        if 'all_uploaded_files' in locals():
            cleanup_uploaded_files(all_uploaded_files)

        print(f"❌ API ERROR: {str(e)}")
        return jsonify({
            "error": "Internal server error",
            "message": str(e)
        }), 500


@app.route('/process-simple', methods=['POST'])
def process_documents_simple():
    """
    Simplified endpoint - only accepts experience letters

    Expected form data:
    - files: List of PDF files (experience letters)
    - threshold_strength: String (optional) - default: "none"
    """
    try:
        # Get threshold strength parameter
        threshold_strength = request.form.get('threshold_strength', 'none')

        # Get uploaded files
        files = request.files.getlist('files')

        if not files or len(files) == 0:
            return jsonify({
                "error": "No files uploaded. At least one experience letter is required."
            }), 400

        # Check if files are actually uploaded (not empty)
        if all(file.filename == '' for file in files):
            return jsonify({
                "error": "No valid files uploaded"
            }), 400

        # Save uploaded files
        file_paths = save_uploaded_files(files, "exp_letter")

        if not file_paths:
            return jsonify({
                "error": "No valid PDF files uploaded"
            }), 400

        print(f"\n{'='*70}")
        print(f"📥 SIMPLE API REQUEST RECEIVED")
        print(f"Files: {len(file_paths)}")
        print(f"Threshold Strength: {threshold_strength}")
        print(f"{'='*70}")

        # Initialize processor
        processor = WorkExperienceProcessor(
            threshold_strength=threshold_strength)

        # Process documents (all as experience letters)
        result = processor.process_documents(
            experience_letters=file_paths
        )

        # Cleanup uploaded files
        cleanup_uploaded_files(file_paths)

        # Convert result to JSON
        output = result.model_dump(mode='json')

        print(f"\n✅ SIMPLE API REQUEST COMPLETED")
        print(f"Status: {result.status}")
        print(f"Valid Experiences: {result.valid_experiences}\n")

        return jsonify(output), 200

    except Exception as e:
        # Cleanup any uploaded files on error
        if 'file_paths' in locals():
            cleanup_uploaded_files(file_paths)

        print(f"❌ API ERROR: {str(e)}")
        return jsonify({
            "error": "Internal server error",
            "message": str(e)
        }), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        "error": "File too large. Maximum file size is 50MB"
    }), 413


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        "error": "Internal server error"
    }), 500


if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 WORK EXPERIENCE EXTRACTION API SERVER")
    print("="*70)
    print(f"📍 Server running on: http://localhost:7005")
    print(f"🏥 Health check: http://localhost:7005/health")
    print(f"📝 Process endpoint: http://localhost:7005/process")
    print(f"📝 Simple endpoint: http://localhost:7005/process-simple")
    print("="*70)
    print("\nEndpoints:")
    print("  POST /process - Full document processing")
    print("    - experience_letters: PDF files (required)")
    print("    - offer_letters: PDF files (optional)")
    print("    - relieving_letters: PDF files (optional)")
    print("    - salary_slips: PDF files (optional)")
    print("    - other_documents: PDF files (optional)")
    print("    - threshold_strength: none|light|medium|strong (optional)")
    print("\n  POST /process-simple - Simple processing")
    print("    - files: PDF files (experience letters)")
    print("    - threshold_strength: none|light|medium|strong (optional)")
    print("\n  GET /health - Health check")
    print("="*70 + "\n")

    app.run(host='0.0.0.0', port=7005, debug=True)
