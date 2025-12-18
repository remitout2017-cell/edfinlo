import json
from pathlib import Path
from typing import Any, List

def save_json(data: Any, filename: str, pretty: bool = True) -> str:
    """Save data as JSON file"""
    path = Path(filename)
    with open(path, 'w', encoding='utf-8') as f:
        if pretty:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        else:
            json.dump(data, f, ensure_ascii=False, default=str)
    
    print(f"💾 Saved: {path}")
    return str(path)

def load_json(filename: str) -> Any:
    """Load data from JSON file"""
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def cleanup_files(file_paths: List[str]):
    """Delete list of files"""
    deleted = 0
    for file_path in file_paths:
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                deleted += 1
        except Exception as e:
            print(f"⚠️ Could not delete {file_path}: {e}")
    
    if deleted > 0:
        print(f"🗑️ Cleaned up {deleted} files")
