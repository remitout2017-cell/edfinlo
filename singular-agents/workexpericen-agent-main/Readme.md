# Work Experience Extraction Agent

AI-powered work experience extraction from employment documents using Gemini Vision and structured output.

## 📁 Project Structure

```
work-experience-agent/
│
├── config.py                    # Configuration & constants
├── schemas.py                   # Pydantic data models
├── session_manager.py          # Session management
├── preprocessor.py             # Image/PDF preprocessing
├── utils.py                    # Helper functions
├── main.py                     # Main orchestrator
│
├── extractors/                 # Extraction modules
│   ├── __init__.py
│   ├── base_extractor.py      # Base class with Gemini
│   └── work_extractor.py      # Work experience extractor
│
├── analyzers/                  # Analysis modules
│   ├── __init__.py
│   └── work_verifier.py       # Verification logic
│
├── temp_sessions/              # Temporary files (auto-created)
│
├── .env                        # Environment variables
├── requirements.txt            # Dependencies
└── README.md                   # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```env
GEMINI_API_KEY=your_gemini_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
GROQ_API_KEY=your_groq_key_here
```

### 3. Run Extraction

```python
from main import WorkExperienceProcessor

# Initialize processor
processor = WorkExperienceProcessor(threshold_strength="none")

# Process documents
result = processor.process_documents(
    pdf_paths=[
        "experience_letter_1.pdf",
        "experience_letter_2.pdf"
    ]
)

# Access results
print(f"Total Experience: {result.total_years_experience} years")
print(f"Valid Entries: {result.valid_experiences}")

# Save to JSON
from utils import save_json
save_json(result.model_dump(mode='json'), "output.json")
```

## 📊 What Gets Extracted

- **Company Name** - From letterhead, footer, or email domain
- **Job Title** - Position/designation/role
- **Employment Type** - Full-time, part-time, internship, contract, etc.
- **Start Date** - Date of joining (DD/MM/YYYY)
- **End Date** - Last working day (DD/MM/YYYY)
- **Currently Working** - Boolean flag
- **Salary/Stipend** - Compensation amount
- **Payment Status** - Paid vs unpaid

## 🔍 Verification

Each extracted entry is automatically verified for:

- ✅ Required fields present
- ✅ Valid date formats
- ✅ Logical date chronology
- ✅ Reasonable salary ranges
- ✅ Document quality assessment

## ⚙️ Configuration Options

### Preprocessing Thresholds

```python
processor = WorkExperienceProcessor(
    threshold_strength="none"  # Recommended for AI
    # Options: "none", "light", "medium", "strong"
)
```

### Validation Rules (config.py)

```python
MIN_SALARY = 1000
MAX_SALARY = 10000000
MIN_START_YEAR = 1980
MAX_FUTURE_YEAR = 2026
```

## 📦 Output Schema

```json
{
  "session_id": "abc123",
  "work_experiences": [
    {
      "company_name": "Tech Corp",
      "job_title": "Software Engineer",
      "employment_type": "full_time",
      "start_date": "15/03/2020",
      "end_date": "30/06/2023",
      "currently_working": false,
      "is_paid": true,
      "stipend_amount": 50000,
      "extraction_confidence": 0.92
    }
  ],
  "verifications": [
    {
      "valid": true,
      "confidence": "high",
      "reason": "All required fields present and valid",
      "issues": [],
      "warnings": []
    }
  ],
  "total_documents": 2,
  "valid_experiences": 2,
  "total_years_experience": 3.3,
  "processing_time_seconds": 12.5,
  "status": "success"
}
```

## 🛠️ Advanced Usage

### Custom Timeout

```python
# In extractors/work_extractor.py
result = self.extract_structured(
    image_path=image_path,
    schema=WorkExperience,
    prompt=self.PROMPT,
    timeout=120  # Increase for slow connections
)
```

### Disable Auto-Cleanup

```python
# In config.py
AUTO_CLEANUP = False  # Keep temp files for debugging
```

### Process Single Document

```python
result = processor.process_documents(
    pdf_paths=["single_document.pdf"]
)
```

## 🐛 Troubleshooting

### API Quota Errors

The system automatically falls back to OpenRouter when Gemini quota is exceeded.

### Poor Extraction Quality

1. Try different preprocessing thresholds: `"light"`, `"medium"`, `"strong"`
2. Check document quality (clear scans work best)
3. Ensure document is in supported format (PDF, PNG, JPG)

### Date Format Issues

The extractor expects DD/MM/YYYY format. Other formats are converted automatically.

## 📝 Notes

- **Automatic Cleanup**: Temp files are deleted after processing (configurable)
- **Session Management**: Each processing run gets a unique session ID
- **Concurrent Processing**: Multiple documents processed in sequence
- **Fallback Model**: OpenRouter used if Gemini fails

## 🤝 Similar to Academic Agent

This agent follows the same architecture as the academic records extraction agent:
- Same folder structure
- Same base extractor pattern
- Same preprocessing pipeline
- Consistent error handling
- Similar verification approach

## 📄 License

MIT License - Feel free to use and modify!