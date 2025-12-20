import cv2
import numpy as np
from pathlib import Path
from typing import List, Optional
import fitz  # PyMuPDF
from PIL import Image

from config import Config

class ImagePreprocessor:
    """Preprocess images for better OCR/extraction"""
    
    def __init__(self, target_width: int = Config.TARGET_IMAGE_WIDTH):
        self.target_width = target_width
        print(f"✅ Image Preprocessor initialized (target width: {target_width}px)")
    
    def convert_pdf_to_images(self, pdf_path: str, output_dir: str) -> List[str]:
        """Convert PDF pages to images"""
        try:
            pdf_document = fitz.open(pdf_path)
            image_paths = []
            
            max_pages = min(len(pdf_document), Config.MAX_PAGES_PER_DOCUMENT)
            
            for page_num in range(max_pages):
                page = pdf_document[page_num]
                
                # Render at high DPI for quality
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                
                # Save as image
                output_path = Path(output_dir) / f"page_{page_num + 1}.png"
                pix.save(str(output_path))
                image_paths.append(str(output_path))
            
            pdf_document.close()
            print(f"✅ Converted {len(image_paths)} pages from PDF")
            return image_paths
            
        except Exception as e:
            print(f"❌ PDF conversion error: {e}")
            return []
    
    def preprocess_image(self, image_path: str, enhance: bool = True) -> np.ndarray:
        """Preprocess image for better extraction"""
        try:
            # Read image
            img = cv2.imread(image_path)
            
            if img is None:
                raise ValueError(f"Failed to read image: {image_path}")
            
            # Resize if too large
            height, width = img.shape[:2]
            if width > self.target_width:
                scale = self.target_width / width
                new_width = self.target_width
                new_height = int(height * scale)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
            
            if enhance:
                # Convert to grayscale
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                
                # Denoise
                denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
                
                # Increase contrast
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(denoised)
                
                # Slight sharpening
                kernel = np.array([[-1, -1, -1],
                                   [-1,  9, -1],
                                   [-1, -1, -1]])
                sharpened = cv2.filter2D(enhanced, -1, kernel)
                
                # Convert back to BGR for consistency
                img = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
            
            return img
            
        except Exception as e:
            print(f"❌ Image preprocessing error: {e}")
            raise
    
    def save_image(self, image: np.ndarray, output_path: str):
        """Save preprocessed image"""
        try:
            cv2.imwrite(output_path, image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        except Exception as e:
            print(f"❌ Image save error: {e}")
            raise
