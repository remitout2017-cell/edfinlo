"""
Base Chain for all extraction chains - Fixed for Gemini Vision multimodal support
"""

import logging
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from config import Config

logger = logging.getLogger(__name__)


class BaseChain:
    """Base class for all extraction chains with proper Gemini Vision support"""

    def __init__(self, model_name: str = Config.GEMINI_VISION_MODEL):
        """Initialize chain with Gemini model"""
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=Config.GEMINI_API_KEY,
            temperature=0.1,  # Low temperature for consistent extraction
            max_output_tokens=8192
        )
        logger.info(
            f"✅ Initialized {self.__class__.__name__} with {model_name}")

    def format_images_for_prompt(self, images: List[dict]) -> str:
        """Format images description for prompt"""
        return f"Analyzing {len(images)} pages"

    def create_gemini_content(self, prompt: str, images: List[dict]) -> List:
        """
        Create proper content format for Gemini Vision API

        Args:
            prompt: Text prompt
            images: List of dicts with 'base64' and 'mime_type' keys

        Returns:
            List of content parts for Gemini
        """
        from langchain_core.messages import HumanMessage

        # Build content parts
        content_parts = [{"type": "text", "text": prompt}]

        # Add images in proper format
        for img_data in images:
            content_parts.append({
                "type": "image_url",
                "image_url": f"data:{img_data['mime_type']};base64,{img_data['base64']}"
            })

        return [HumanMessage(content=content_parts)]
