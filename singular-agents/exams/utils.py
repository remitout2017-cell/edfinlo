import json
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime, date

def save_json(data: Dict[str, Any], filename: str, indent: int = 2):
    """Save data as JSON file with date serialization"""
    try:
        class DateTimeEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, (datetime, date)):
                    return obj.isoformat()
                return super().default(obj)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=indent, cls=DateTimeEncoder, ensure_ascii=False)
        print(f"✅ Saved JSON to: {filename}")
        return True
    except Exception as e:
        print(f"❌ JSON save error: {e}")
        return False

def load_json(filename: str) -> Optional[Dict[str, Any]]:
    """Load JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded JSON from: {filename}")
        return data
    except Exception as e:
        print(f"❌ JSON load error: {e}")
        return None

def cleanup_files(file_paths: list):
    """Delete multiple files"""
    deleted = 0
    for file_path in file_paths:
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                deleted += 1
        except Exception as e:
            print(f"⚠️ Failed to delete {file_path}: {e}")
    
    if deleted > 0:
        print(f"🗑️ Cleaned up {deleted} files")

def format_date(date_obj: Optional[date]) -> str:
    """Format date object to string"""
    if date_obj is None:
        return "N/A"
    return date_obj.strftime("%Y-%m-%d")

def calculate_score_validity(test_date: Optional[date], validity_years: int) -> Optional[date]:
    """Calculate score expiry date"""
    if test_date is None:
        return None
    from datetime import timedelta
    return test_date + timedelta(days=365 * validity_years)

def is_score_valid(test_date: Optional[date], validity_years: int) -> bool:
    """Check if score is still valid"""
    if test_date is None:
        return False
    expiry = calculate_score_validity(test_date, validity_years)
    return datetime.now().date() <= expiry
