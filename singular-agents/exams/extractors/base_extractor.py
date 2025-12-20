from abc import ABC, abstractmethod
from typing import List, Optional, Any
import base64
from pathlib import Path

class BaseExtractor(ABC):
    """Base class for all test score extractors"""
    
    def __init__(self, llm):
        self.llm = llm
    
    @abstractmethod
    def extract(self, image_paths: List[str]) -> Optional[Any]:
        """Extract scores from images - must be implemented by subclass"""
        pass
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image file to base64 string"""
        try:
            with open(image_path, "rb") as image_file:
                encoded = base64.b64encode(image_file.read()).decode('utf-8')
            return encoded
        except Exception as e:
            print(f"❌ Image encoding error for {image_path}: {e}")
            raise
    
    def _validate_image_path(self, image_path: str) -> bool:
        """Check if image path is valid"""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        if path.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.pdf']:
            raise ValueError(f"Invalid image format: {path.suffix}")
        return True
    
    def _validate_image_paths(self, image_paths: List[str]) -> bool:
        """Validate all image paths"""
        for path in image_paths:
            self._validate_image_path(path)
        return True
