"""
PDF to Image Processor using PyMuPDF (fitz)
Much faster and no external dependencies needed!
"""
import fitz  # PyMuPDF
from PIL import Image
import base64
from io import BytesIO
from pathlib import Path
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


class PDFProcessor:
    """Convert PDFs to images using PyMuPDF (fitz)"""

    @staticmethod
    def pdf_to_images(pdf_path: str, max_pages: int = 20, dpi: int = 300) -> List[Image.Image]:
        """
        Convert PDF to list of PIL Images using PyMuPDF

        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum pages to process (cost control)
            dpi: Resolution (300 is good quality)

        Returns:
            List of PIL Image objects
        """
        try:
            logger.info(f"Converting PDF to images: {pdf_path}")

            # Open PDF
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            pages_to_process = min(total_pages, max_pages)

            logger.info(
                f"   Total pages: {total_pages}, Processing: {pages_to_process}")

            images = []

            # Calculate zoom for desired DPI
            # fitz default is 72 DPI, so zoom = desired_dpi / 72
            zoom = dpi / 72
            mat = fitz.Matrix(zoom, zoom)

            for page_num in range(pages_to_process):
                try:
                    # Get page
                    page = pdf_document[page_num]

                    # Render page to pixmap
                    pix = page.get_pixmap(matrix=mat, alpha=False)

                    # Convert to PIL Image
                    img = Image.frombytes(
                        "RGB", [pix.width, pix.height], pix.samples)

                    images.append(img)

                    if (page_num + 1) % 5 == 0:
                        logger.info(
                            f"   Processed {page_num + 1}/{pages_to_process} pages")

                except Exception as e:
                    logger.error(
                        f"   ❌ Error processing page {page_num + 1}: {e}")
                    continue

            pdf_document.close()

            logger.info(f"   ✅ Converted {len(images)} pages successfully")
            return images

        except Exception as e:
            logger.error(f"❌ PDF conversion error: {e}")
            raise

    @staticmethod
    def optimize_image(image: Image.Image, max_size: Tuple[int, int] = (1024, 1024)) -> Image.Image:
        """
        Optimize image size for API efficiency

        Args:
            image: PIL Image
            max_size: Maximum dimensions (width, height)

        Returns:
            Optimized PIL Image
        """
        # Resize if too large (maintain aspect ratio)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        return image

    @staticmethod
    def image_to_base64(image: Image.Image, quality: int = 85) -> str:
        """
        Convert PIL Image to base64 string

        Args:
            image: PIL Image
            quality: JPEG quality (1-100)

        Returns:
            Base64 encoded string
        """
        buffered = BytesIO()
        image.save(buffered, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buffered.getvalue()).decode()

    @staticmethod
    def process_pdf_for_gemini(
        pdf_path: str,
        max_pages: int = 20,
        dpi: int = 200,
        optimize: bool = True
    ) -> List[dict]:
        """
        Process PDF and prepare for Gemini Vision API
        """
        logger.info(f"📄 Processing PDF: {Path(pdf_path).name}")

        # Convert to images
        images = PDFProcessor.pdf_to_images(pdf_path, max_pages, dpi)

        processed_images = []
        for idx, img in enumerate(images, 1):
            try:
                # Optimize if requested
                if optimize:
                    img = PDFProcessor.optimize_image(
                        img, max_size=(1536, 1536))

                # Convert to base64
                base64_img = PDFProcessor.image_to_base64(img, quality=85)

                processed_images.append({
                    "page_number": idx,
                    "image": img,  # Keep for reference
                    "base64": base64_img,  # Base64 string
                    "mime_type": "image/jpeg"
                })

            except Exception as e:
                logger.error(f"   ❌ Error processing page {idx}: {e}")
                continue

        logger.info(
            f"   ✅ Processed {len(processed_images)} images for Gemini")
        return processed_images

    @staticmethod
    def extract_text_from_pdf(pdf_path: str, max_pages: int = None) -> str:
        """
        Extract raw text from PDF (useful for fallback)

        Args:
            pdf_path: Path to PDF
            max_pages: Maximum pages to extract

        Returns:
            str: Extracted text
        """
        try:
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            pages_to_process = min(
                total_pages, max_pages) if max_pages else total_pages

            text_content = []

            for page_num in range(pages_to_process):
                page = pdf_document[page_num]
                text = page.get_text()
                if text.strip():
                    text_content.append(f"--- Page {page_num + 1} ---\n{text}")

            pdf_document.close()

            return "\n\n".join(text_content)

        except Exception as e:
            logger.error(f"❌ Text extraction error: {e}")
            return ""

    @staticmethod
    def get_pdf_info(pdf_path: str) -> dict:
        """
        Get PDF metadata

        Args:
            pdf_path: Path to PDF

        Returns:
            dict: PDF information
        """
        try:
            pdf_document = fitz.open(pdf_path)

            info = {
                "filename": Path(pdf_path).name,
                "total_pages": len(pdf_document),
                "file_size_mb": Path(pdf_path).stat().st_size / (1024 * 1024),
                "metadata": pdf_document.metadata,
                "is_encrypted": pdf_document.is_encrypted,
                "is_pdf": pdf_document.is_pdf
            }

            pdf_document.close()

            return info

        except Exception as e:
            logger.error(f"❌ Error getting PDF info: {e}")
            return {}


# Quick test function
def test_processor():
    """Test the PDF processor"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python pdf_processor.py <path_to_pdf>")
        return

    pdf_path = sys.argv[1]

    print(f"\n{'='*60}")
    print(f"Testing PDF Processor with PyMuPDF (fitz)")
    print(f"{'='*60}\n")

    # Get PDF info
    print("📊 PDF Information:")
    info = PDFProcessor.get_pdf_info(pdf_path)
    for key, value in info.items():
        print(f"   {key}: {value}")

    # Process for Gemini
    print(f"\n📄 Processing PDF for Gemini...")
    processed = PDFProcessor.process_pdf_for_gemini(pdf_path, max_pages=3)

    print(f"\n✅ Processed {len(processed)} pages")
    for page in processed:
        print(f"   Page {page['page_number']}: {page['image'].size}")

    # Extract text (optional)
    print(f"\n📝 Extracting text...")
    text = PDFProcessor.extract_text_from_pdf(pdf_path, max_pages=2)
    print(f"   Extracted {len(text)} characters")
    if text:
        print(f"\n   First 200 chars:\n   {text[:200]}...")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    test_processor()
