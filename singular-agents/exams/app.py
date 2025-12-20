from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pathlib import Path
import time
import traceback
from datetime import datetime

from config import Config
from main import TestScoreProcessor
from schemas import TestType

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

# Temp upload directory
UPLOAD_DIR = Path("temp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

processor = TestScoreProcessor()

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Test Score Extraction API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "gemini_configured": bool(Config.GEMINI_API_KEY),
            "groq_configured": bool(Config.GROQ_API_KEY),
            "auto_cleanup": Config.AUTO_CLEANUP
        }
    }), 200

@app.route('/process/toefl', methods=['POST'])
def process_toefl():
    """Process TOEFL score report"""
    return _process_test_score(TestType.TOEFL, "toefl_report")

@app.route('/process/gre', methods=['POST'])
def process_gre():
    """Process GRE score report"""
    return _process_test_score(TestType.GRE, "gre_report")

@app.route('/process/ielts', methods=['POST'])
def process_ielts():
    """Process IELTS test report form"""
    return _process_test_score(TestType.IELTS, "ielts_report")

def _process_test_score(test_type: TestType, file_field: str):
    """Generic test score processing"""
    start_time = time.time()
    
    try:
        # Check if file present
        if file_field not in request.files:
            return jsonify({"error": f"No {file_field} file provided"}), 400
        
        file = request.files[file_field]
        
        if file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Use PDF, PNG, or JPG"}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        timestamp = int(time.time() * 1000)
        save_path = UPLOAD_DIR / f"{timestamp}_{filename}"
        file.save(str(save_path))
        
        # Process
        result = processor.process_document(str(save_path), test_type)
        
        # Cleanup
        if Config.AUTO_CLEANUP:
            save_path.unlink(missing_ok=True)
        
        processing_time = round(time.time() - start_time, 2)
        
        return jsonify({
            "success": True,
            "test_type": test_type.value,
            "processing_time_seconds": processing_time,
            "data": result.model_dump(mode="json")
        }), 200
        
    except Exception as e:
        print(f"❌ API ERROR: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "error": "Internal server error",
            "message": str(e)
        }), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File too large. Maximum 50MB"}), 413

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🎓 TEST SCORE EXTRACTION API SERVER")
    print("="*70)
    print(f"📍 Server: http://localhost:7006")
    print(f"🏥 Health: http://localhost:7006/health")
    print(f"📝 Endpoints:")
    print(f"   POST /process/toefl  - Process TOEFL report")
    print(f"   POST /process/gre    - Process GRE report")
    print(f"   POST /process/ielts  - Process IELTS report")
    print("="*70 + "\n")
    
    app.run(host='0.0.0.0', port=7006, debug=True)
