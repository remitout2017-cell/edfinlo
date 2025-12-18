import cv2
import numpy as np
import fitz  # PyMuPDF
from PIL import Image
import os
from pathlib import Path
from typing import List

class ProductionImagePreprocessor:
    """Production-ready preprocessor with configurable threshold"""
    
    def __init__(self, target_width: int = 2000, use_threshold: bool = True, threshold_strength: str = "medium"):
        """
        Args:
            target_width: Target image width
            use_threshold: Whether to apply thresholding
            threshold_strength: "light", "medium", "strong", or "none"
        """
        self.target_width = target_width
        self.use_threshold = use_threshold
        self.threshold_strength = threshold_strength
        print(f"✅ Preprocessor initialized (Threshold: {threshold_strength})")
    
    def convert_pdf_to_images(self, pdf_path: str, output_folder: str = "temp_images") -> List[str]:
        """Convert PDF to images using PyMuPDF"""
        print(f"\n📄 Converting PDF: {pdf_path}")
        
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        os.makedirs(output_folder, exist_ok=True)
        
        try:
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            print(f"  📖 Total pages: {total_pages}")
            
            image_paths = []
            for page_num in range(total_pages):
                page = pdf_document.load_page(page_num)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                image_path = os.path.join(output_folder, f"page_{page_num + 1}.jpg")
                pix.save(image_path)
                image_paths.append(image_path)
                print(f"  ✅ Page {page_num + 1}/{total_pages} → {image_path}")
            
            pdf_document.close()
            print(f"\n✅ PDF converted successfully! {len(image_paths)} images created")
            return image_paths
            
        except Exception as e:
            raise Exception(f"PDF conversion failed: {str(e)}")
    
    def preprocess_image(self, image_path: str, save_debug: bool = False) -> np.ndarray:
        """Preprocess image for AI extraction"""
        print(f"\n🖼️ Processing: {Path(image_path).name}")
        
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot load: {image_path}")
        
        original_size = f"{image.shape[1]}×{image.shape[0]}"
        
        # Step 1: Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Step 2: Smart resize
        resized = self._smart_resize(gray)
        
        # Step 3: Strong noise removal
        print("  🧹 Removing noise...")
        denoised = cv2.fastNlMeansDenoising(
            resized, None, h=10, templateWindowSize=7, searchWindowSize=21)
        
        # Step 4: Contrast enhancement
        print("  ✨ Enhancing contrast...")
        enhanced = self._enhance_contrast(denoised)
        
        # Step 5: Sharpen text
        print("  🔪 Sharpening text...")
        sharpened = self._sharpen_image(enhanced)
        
        # Step 6: Apply threshold based on settings
        if self.threshold_strength == "none" or not self.use_threshold:
            print("  ⏭️ Skipping threshold...")
            thresholded = sharpened
        elif self.threshold_strength == "light":
            print("  🎯 Applying light threshold...")
            thresholded = self._apply_light_threshold(sharpened)
        elif self.threshold_strength == "medium":
            print("  🎯 Applying medium threshold...")
            thresholded = self._apply_medium_threshold(sharpened)
        elif self.threshold_strength == "strong":
            print("  🎯 Applying strong threshold (Otsu)...")
            _, thresholded = cv2.threshold(
                sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            thresholded = sharpened
        
        # Step 7: Clean small noise
        if self.use_threshold and self.threshold_strength != "none":
            print("  🧼 Final cleanup...")
            cleaned = self._clean_noise(thresholded)
        else:
            cleaned = thresholded
        
        final_size = f"{cleaned.shape[1]}×{cleaned.shape[0]}"
        print(f"  ✅ Done! {original_size} → {final_size}")
        
        return cleaned
    
    def _apply_light_threshold(self, image: np.ndarray) -> np.ndarray:
        """Light threshold - preserves more gray tones"""
        _, result = cv2.threshold(image, 180, 255, cv2.THRESH_BINARY)
        return result
    
    def _apply_medium_threshold(self, image: np.ndarray) -> np.ndarray:
        """Medium threshold - adaptive threshold"""
        result = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        return result
    
    def _smart_resize(self, image: np.ndarray) -> np.ndarray:
        """Upscale small images, downscale large ones"""
        height, width = image.shape[:2]
        
        if width < self.target_width:
            scale = self.target_width / width
            new_width = self.target_width
            new_height = int(height * scale)
            resized = cv2.resize(
                image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            print(f"  📏 Upscaled: {width}×{height} → {new_width}×{new_height}")
        elif width > self.target_width:
            scale = self.target_width / width
            new_width = self.target_width
            new_height = int(height * scale)
            resized = cv2.resize(
                image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            print(f"  📏 Downscaled: {width}×{height} → {new_width}×{new_height}")
        else:
            resized = image
            print(f"  📏 Size OK: {width}×{height}")
        
        return resized
    
    def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """CLAHE - makes text darker, background lighter"""
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        return clahe.apply(image)
    
    def _sharpen_image(self, image: np.ndarray) -> np.ndarray:
        """Sharpen text edges"""
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]])
        return cv2.filter2D(image, -1, kernel)
    
    def _clean_noise(self, image: np.ndarray) -> np.ndarray:
        """Remove small dots"""
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        opening = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel, iterations=1)
        closing = cv2.morphologyEx(opening, cv2.MORPH_CLOSE, kernel, iterations=1)
        return closing
    
    def save_preprocessed_image(self, processed_image: np.ndarray, output_path: str) -> str:
        """Save final preprocessed image"""
        cv2.imwrite(output_path, processed_image)
        print(f"💾 Saved: {output_path}")
        return output_path
