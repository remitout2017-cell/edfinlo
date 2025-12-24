"""
PDF Processor - CORRECTED
✅ Fixed memory leak with generator pattern
✅ Better error handling
✅ Configurable optimization
"""

import fitz
from PIL import Image
import base64
from io import BytesIO
from pathlib import Path
from typing import List, Tuple, Generator, Optional
import logging
import gc

from config import Config

logger = logging.getLogger(__name__)


class PDFProcessor:
    """
    Optimized PDF processor with memory management
    ✅ CORRECTED: Generator pattern to avoid memory leaks
    """

    @staticmethod
    def pdf_to_images(
        pdf_path: str,
        max_pages: int = 20,
        dpi: int = 150
    ) -> List[Image.Image]:
        """
        Convert PDF to images with memory management
        ✅ FIXED: Better memory cleanup

        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum pages to process
            dpi: DPI for rendering (150 is optimal)

        Returns:
            List of PIL Images
        """
        try:
            logger.info(f"Converting PDF to images: {pdf_path}")
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            pages_to_process = min(total_pages, max_pages)

            images = []
            zoom = dpi / 72
            mat = fitz.Matrix(zoom, zoom)

            for page_num in range(pages_to_process):
                try:
                    page = pdf_document[page_num]
                    pix = page.get_pixmap(matrix=mat, alpha=False)

                    img = Image.frombytes(
                        "RGB", [pix.width, pix.height], pix.samples
                    )
                    images.append(img)

                    # ✅ Free memory immediately
                    del pix

                    # ✅ Force GC every 10 pages for large PDFs
                    if (page_num + 1) % 10 == 0:
                        gc.collect()

                except Exception as e:
                    logger.error(
                        f"❌ Error processing page {page_num + 1}: {e}")
                    continue

            pdf_document.close()
            gc.collect()

            logger.info(f"✅ Converted {len(images)} pages")
            return images

        except Exception as e:
            logger.error(f"❌ PDF conversion error: {e}")
            raise

    @staticmethod
    def pdf_to_images_generator(
        pdf_path: str,
        max_pages: int = 20,
        dpi: int = 150
    ) -> Generator[Image.Image, None, None]:
        """
        ✅ NEW: Generator pattern to avoid memory accumulation
        Use this for very large PDFs

        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum pages to process
            dpi: DPI for rendering

        Yields:
            PIL Image objects one at a time
        """
        pdf_document = None
        try:
            logger.info(f"Converting PDF to images (generator): {pdf_path}")
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            pages_to_process = min(total_pages, max_pages)

            zoom = dpi / 72
            mat = fitz.Matrix(zoom, zoom)

            for page_num in range(pages_to_process):
                try:
                    page = pdf_document[page_num]
                    pix = page.get_pixmap(matrix=mat, alpha=False)

                    img = Image.frombytes(
                        "RGB", [pix.width, pix.height], pix.samples
                    )

                    # ✅ Cleanup before yielding
                    del pix

                    yield img

                    # ✅ Force cleanup after yield
                    del img

                    if (page_num + 1) % 5 == 0:
                        gc.collect()

                except Exception as e:
                    logger.error(
                        f"❌ Error processing page {page_num + 1}: {e}")
                    continue

        except Exception as e:
            logger.error(f"❌ PDF conversion error: {e}")
            raise
        finally:
            if pdf_document:
                pdf_document.close()
            gc.collect()

    @staticmethod
    def optimize_image(
        image: Image.Image,
        max_size: Optional[Tuple[int, int]] = None
    ) -> Image.Image:
        """
        Optimize image only if needed
        ✅ FIXED: Conditional optimization

        Args:
            image: PIL Image to optimize
            max_size: Maximum dimensions (width, height)

        Returns:
            Optimized PIL Image
        """
        if max_size is None:
            max_size = Config.PDF_MAX_IMAGE_SIZE

        # Skip optimization if already small enough
        if image.width <= max_size[0] and image.height <= max_size[1]:
            if image.mode == 'RGB':
                return image
            return image.convert('RGB')

        # Resize only if needed
        image.thumbnail(max_size, Image.Resampling.LANCZOS)

        if image.mode != 'RGB':
            image = image.convert('RGB')

        return image

    @staticmethod
    def image_to_base64(
        image: Image.Image,
        quality: Optional[int] = None
    ) -> str:
        """
        Convert PIL Image to base64
        ✅ FIXED: Better memory cleanup

        Args:
            image: PIL Image
            quality: JPEG quality (1-95)

        Returns:
            Base64 encoded string
        """
        if quality is None:
            quality = Config.PDF_JPEG_QUALITY

        buffered = BytesIO()
        try:
            image.save(buffered, format="JPEG", quality=quality, optimize=True)
            b64 = base64.b64encode(buffered.getvalue()).decode()
            return b64
        finally:
            buffered.close()

    @staticmethod
    def process_pdf_for_gemini(
        pdf_path: str,
        max_pages: int = 20,
        dpi: int = 150,
        optimize: bool = True
    ) -> List[dict]:
        """
        Process PDF for Gemini Vision API
        ✅ CORRECTED: Better memory management

        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum pages to process
            dpi: DPI for rendering
            optimize: Whether to optimize images

        Returns:
            List of dicts with page_number, base64, mime_type
        """
        logger.info(f"📄 Processing PDF: {Path(pdf_path).name}")

        # Convert to images
        images = PDFProcessor.pdf_to_images(pdf_path, max_pages, dpi)
        processed_images = []

        for idx, img in enumerate(images, 1):
            try:
                # Optimize if requested
                if optimize:
                    img = PDFProcessor.optimize_image(img)

                # Convert to base64
                base64_img = PDFProcessor.image_to_base64(img)

                processed_images.append({
                    "page_number": idx,
                    "base64": base64_img,
                    "mime_type": "image/jpeg"
                })

                # ✅ Delete image immediately after conversion
                del img

            except Exception as e:
                logger.error(f"❌ Error processing page {idx}: {e}")
                continue

        # ✅ Delete original images list
        del images
        gc.collect()

        logger.info(f"✅ Processed {len(processed_images)} images")
        return processed_images

    @staticmethod
    def process_pdf_for_gemini_generator(
        pdf_path: str,
        max_pages: int = 20,
        dpi: int = 150,
        optimize: bool = True
    ) -> Generator[dict, None, None]:
        """
        ✅ NEW: Generator version for streaming processing
        Best for very large PDFs to minimize memory usage

        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum pages to process
            dpi: DPI for rendering
            optimize: Whether to optimize images

        Yields:
            Dict with page_number, base64, mime_type
        """
        logger.info(f"📄 Processing PDF (streaming): {Path(pdf_path).name}")

        image_gen = PDFProcessor.pdf_to_images_generator(
            pdf_path, max_pages, dpi)

        for idx, img in enumerate(image_gen, 1):
            try:
                # Optimize if requested
                if optimize:
                    img = PDFProcessor.optimize_image(img)

                # Convert to base64
                base64_img = PDFProcessor.image_to_base64(img)

                yield {
                    "page_number": idx,
                    "base64": base64_img,
                    "mime_type": "image/jpeg"
                }

                # ✅ Cleanup
                del img
                del base64_img

            except Exception as e:
                logger.error(f"❌ Error processing page {idx}: {e}")
                continue

    @staticmethod
    def validate_pdf(pdf_path: str) -> Tuple[bool, Optional[str]]:
        """
        ✅ NEW: Validate PDF file before processing

        Args:
            pdf_path: Path to PDF file

        Returns:
            Tuple of (is_valid, error_message)
        """
        path = Path(pdf_path)

        # Check existence
        if not path.exists():
            return False, f"File not found: {pdf_path}"

        # Check extension
        if path.suffix.lower() != '.pdf':
            return False, f"Not a PDF file: {pdf_path}"

        # Check size
        size_mb = path.stat().st_size / (1024 * 1024)
        if size_mb == 0:
            return False, "PDF file is empty"
        if size_mb > Config.MAX_FILE_SIZE_MB:
            return False, f"PDF too large: {size_mb:.1f}MB (max: {Config.MAX_FILE_SIZE_MB}MB)"

        # Try to open with PyMuPDF
        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()

            if page_count == 0:
                return False, "PDF has no pages"

            logger.info(f"✅ Valid PDF: {page_count} pages, {size_mb:.1f}MB")
            return True, None

        except Exception as e:
            return False, f"Invalid or corrupted PDF: {str(e)}"
