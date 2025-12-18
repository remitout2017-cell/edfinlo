import cv2
import numpy as np
import fitz  # PyMuPDF - NO poppler needed!
from PIL import Image
import os
from pathlib import Path
from typing import List


class ProductionImagePreprocessor:
    """
    Production-ready preprocessor:
    - No deskew (removed as requested)
    - No poppler dependency (uses PyMuPDF instead)
    - Works in Docker/Cloud deployment
    """

    def __init__(self, target_width: int = 2000):
        self.target_width = target_width
        print("✅ Preprocessor initialized (PyMuPDF - no poppler needed!)")

    def convert_pdf_to_images(self, pdf_path: str, output_folder: str = "temp_images") -> List[str]:
        """
        Convert PDF to images using PyMuPDF (no poppler dependency!)

        Args:
            pdf_path: Path to PDF file
            output_folder: Where to save images

        Returns:
            List of image file paths
        """
        print(f"\n📄 Converting PDF: {pdf_path}")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        # Create output folder
        os.makedirs(output_folder, exist_ok=True)

        try:
            # Open PDF with PyMuPDF
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            print(f"   📖 Total pages: {total_pages}")

            image_paths = []

            # Convert each page to image
            for page_num in range(total_pages):
                page = pdf_document.load_page(page_num)

                # Render page to image (high quality)
                # matrix = fitz.Matrix(2, 2) means 2x zoom = 144 DPI
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

                # Save as JPEG
                image_path = os.path.join(
                    output_folder, f"page_{page_num + 1}.jpg")
                pix.save(image_path)

                image_paths.append(image_path)
                print(f"   ✅ Page {page_num + 1}/{total_pages} → {image_path}")

            pdf_document.close()
            print(
                f"\n✅ PDF converted successfully! {len(image_paths)} images created")

            return image_paths

        except Exception as e:
            raise Exception(f"PDF conversion failed: {str(e)}")

    def preprocess_image(self, image_path: str, save_debug: bool = False) -> np.ndarray:
        """
        Preprocess image for AI extraction
        NO DESKEW (removed as requested)

        Steps:
        1. Grayscale
        2. Smart resize (upscale/downscale)
        3. Strong noise removal
        4. Contrast enhancement
        5. Sharpen
        6. Otsu threshold
        7. Clean noise
        """
        print(f"\n🖼️  Processing: {Path(image_path).name}")

        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot load: {image_path}")

        original_size = f"{image.shape[1]}×{image.shape[0]}"

        if save_debug:
            cv2.imwrite("step_0_original.jpg", image)

        # Step 1: Grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        if save_debug:
            cv2.imwrite("step_1_grayscale.jpg", gray)

        # Step 2: Smart resize
        resized = self._smart_resize(gray)
        if save_debug:
            cv2.imwrite("step_2_resized.jpg", resized)

        # Step 3: Strong noise removal (removes security patterns)
        print("   🧹 Removing noise...")
        denoised = cv2.fastNlMeansDenoising(
            resized, None, h=10, templateWindowSize=7, searchWindowSize=21)
        if save_debug:
            cv2.imwrite("step_3_denoised.jpg", denoised)

        # Step 4: Contrast enhancement
        print("   ✨ Enhancing contrast...")
        enhanced = self._enhance_contrast(denoised)
        if save_debug:
            cv2.imwrite("step_4_enhanced.jpg", enhanced)

        # Step 5: Sharpen text
        print("   🔪 Sharpening text...")
        sharpened = self._sharpen_image(enhanced)
        if save_debug:
            cv2.imwrite("step_5_sharpened.jpg", sharpened)

        # Step 6: Otsu threshold (automatic!)
        print("   🎯 Applying threshold...")
        _, thresholded = cv2.threshold(
            sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if save_debug:
            cv2.imwrite("step_6_thresholded.jpg", thresholded)

        # Step 7: Clean small noise
        print("   🧼 Final cleanup...")
        cleaned = self._clean_noise(thresholded)
        if save_debug:
            cv2.imwrite("step_7_final.jpg", cleaned)

        final_size = f"{cleaned.shape[1]}×{cleaned.shape[0]}"
        print(f"   ✅ Done! {original_size} → {final_size}")

        return cleaned

    def _smart_resize(self, image: np.ndarray) -> np.ndarray:
        """Upscale small images, downscale large ones"""
        height, width = image.shape[:2]

        if width < self.target_width:
            # UPSCALE
            scale = self.target_width / width
            new_width = self.target_width
            new_height = int(height * scale)
            resized = cv2.resize(
                image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            print(
                f"   📏 Upscaled: {width}×{height} → {new_width}×{new_height}")
        elif width > self.target_width:
            # DOWNSCALE
            scale = self.target_width / width
            new_width = self.target_width
            new_height = int(height * scale)
            resized = cv2.resize(
                image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            print(
                f"   📏 Downscaled: {width}×{height} → {new_width}×{new_height}")
        else:
            resized = image
            print(f"   📏 Size OK: {width}×{height}")

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
        closing = cv2.morphologyEx(
            opening, cv2.MORPH_CLOSE, kernel, iterations=1)
        return closing

    def save_preprocessed_image(self, processed_image: np.ndarray, output_path: str) -> str:
        """Save final preprocessed image"""
        cv2.imwrite(output_path, processed_image)
        print(f"💾 Saved: {output_path}")
        return output_path


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 PRODUCTION PREPROCESSOR TEST")
    print("   - No deskew")
    print("   - No poppler dependency")
    print("   - Production ready!")
    print("=" * 70)

    preprocessor = ProductionImagePreprocessor(target_width=2000)

    # Test 1: Single image (10th/12th marksheet)
    print("\n" + "=" * 70)
    print("TEST 1: Single Image (10th Marksheet)")
    print("=" * 70)

    try:
        image_path = "10.jpg"

        if os.path.exists(image_path):
            processed = preprocessor.preprocess_image(
                image_path, save_debug=True)
            preprocessor.save_preprocessed_image(
                processed, "final_10th_marksheet.jpg")

            print("\n✅ Test 1 PASSED!")
            print("📁 Check: step_*.jpg and final_10th_marksheet.jpg")
        else:
            print(f"⚠️ Image not found: {image_path}")

    except Exception as e:
        print(f"❌ Test 1 FAILED: {e}")
        import traceback
        traceback.print_exc()

    # Test 2: PDF to images (graduation marksheet)
    print("\n" + "=" * 70)
    print("TEST 2: PDF Conversion (Graduation)")
    print("=" * 70)

    try:
        pdf_path = "graduation.pdf"  # Change to your PDF path

        if os.path.exists(pdf_path):
            # Convert PDF to images
            image_paths = preprocessor.convert_pdf_to_images(
                pdf_path, output_folder="graduation_pages")

            # Process each page
            for i, img_path in enumerate(image_paths):
                print(f"\n--- Processing Page {i+1} ---")
                processed = preprocessor.preprocess_image(
                    img_path, save_debug=False)
                output_path = f"final_graduation_page_{i+1}.jpg"
                preprocessor.save_preprocessed_image(processed, output_path)

            print("\n✅ Test 2 PASSED!")
            print(f"📁 {len(image_paths)} pages processed")
        else:
            print(f"⚠️ PDF not found: {pdf_path}")
            print("   Skipping PDF test...")

    except Exception as e:
        print(f"❌ Test 2 FAILED: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 70)
    print("🎉 ALL TESTS COMPLETED")
    print("=" * 70)
