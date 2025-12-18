import shutil
from pathlib import Path
from typing import List

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
    """Save data as JSON"""
    import json
    with open(filepath, 'w') as f:
        json.dump(data, indent=2, fp=f)

def list_images_in_folder(folder: Path) -> List[Path]:
    """Get all image files in a folder"""
    extensions = {'.jpg', '.jpeg', '.png'}
    return sorted([
        f for f in folder.iterdir() 
        if f.suffix.lower() in extensions
    ])
