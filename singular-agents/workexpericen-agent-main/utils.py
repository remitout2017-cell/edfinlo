import shutil
from pathlib import Path
from typing import List
from datetime import datetime
import json


def cleanup_files(*paths):
    """Delete files/directories"""
    for path in paths:
        try:
            path = Path(path)
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                shutil.rmtree(path)
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")


def save_json(data: dict, filepath: str):
    """Save data as JSON with proper datetime handling"""
    
    def json_serializer(obj):
        """Custom JSON serializer for datetime objects"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=json_serializer, ensure_ascii=False)
    
    print(f"💾 Saved JSON to: {filepath}")


def list_images_in_folder(folder: Path) -> List[Path]:
    """Get all image files in a folder"""
    extensions = {'.jpg', '.jpeg', '.png'}
    return sorted([
        f for f in folder.iterdir() 
        if f.suffix.lower() in extensions
    ])


def format_duration(start_date: str, end_date: str = None, currently_working: bool = False) -> str:
    """
    Format work duration in human-readable form
    
    Args:
        start_date: Start date in DD/MM/YYYY format
        end_date: End date in DD/MM/YYYY format (optional)
        currently_working: Whether still working
    
    Returns:
        Formatted duration string (e.g., "2 years 3 months")
    """
    try:
        from datetime import datetime
        
        # Parse start date
        day, month, year = map(int, start_date.split('/'))
        start = datetime(year, month, day)
        
        # Parse or use current date for end
        if currently_working or not end_date:
            end = datetime.now()
        else:
            day, month, year = map(int, end_date.split('/'))
            end = datetime(year, month, day)
        
        # Calculate duration
        duration = end - start
        total_months = duration.days / 30.44  # Average days per month
        
        years = int(total_months // 12)
        months = int(total_months % 12)
        
        if years > 0 and months > 0:
            return f"{years} year{'s' if years > 1 else ''} {months} month{'s' if months > 1 else ''}"
        elif years > 0:
            return f"{years} year{'s' if years > 1 else ''}"
        elif months > 0:
            return f"{months} month{'s' if months > 1 else ''}"
        else:
            days = duration.days
            return f"{days} day{'s' if days > 1 else ''}"
    
    except Exception as e:
        return "Unknown duration"


def validate_date_format(date_str: str) -> bool:
    """
    Validate if date string is in DD/MM/YYYY format
    
    Args:
        date_str: Date string to validate
    
    Returns:
        True if valid, False otherwise
    """
    try:
        if not date_str or len(date_str) != 10:
            return False
        
        day, month, year = map(int, date_str.split('/'))
        
        # Basic validation
        if not (1 <= month <= 12):
            return False
        if not (1 <= day <= 31):
            return False
        if not (1900 <= year <= 2100):
            return False
        
        # Try creating datetime
        datetime(year, month, day)
        return True
    
    except:
        return False


def parse_salary(salary_str: str) -> float:
    """
    Parse salary string and extract numeric value
    
    Args:
        salary_str: Salary string (e.g., "₹25,000", "25000", "Rs. 25,000")
    
    Returns:
        Numeric salary value
    """
    try:
        # Remove currency symbols and commas
        import re
        cleaned = re.sub(r'[^\d.]', '', salary_str)
        return float(cleaned)
    except:
        return 0.0