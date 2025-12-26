"""
Base Chain for all extraction chains - PRODUCTION READY with retry logic
FIXED: Removed deprecated google.generativeai import
"""
import logging
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from config import Config

logger = logging.getLogger(__name__)


class BaseChain:
    """Base class for all extraction chains with proper Gemini Vision support and retry logic"""

    def __init__(self, model_name: str = None, temperature: float = 0.0):
        """Initialize chain with Gemini model"""
        model_name = model_name or Config.GEMINI_VISION_MODEL

        try:
            self.llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=Config.GEMINI_API_KEY,
                temperature=temperature,
                max_output_tokens=8192,
                timeout=Config.TIMEOUT,
                max_retries=Config.MAX_RETRIES
            )
            logger.info(
                f"✅ Initialized {self.__class__.__name__} with {model_name}")
        except Exception as e:
            logger.error(
                f"❌ Failed to initialize {self.__class__.__name__}: {e}")
            raise

    def create_gemini_content(self, prompt: str, images: List[dict]) -> List[HumanMessage]:
        """
        Create proper content format for Gemini Vision API

        Args:
            prompt: Text prompt
            images: List of dicts with 'base64' and 'mime_type' keys

        Returns:
            List containing HumanMessage with multimodal content
        """
        content_parts = [{"type": "text", "text": prompt}]

        # Add images in proper format
        for img_data in images:
            content_parts.append({
                "type": "image_url",
                "image_url": f"data:{img_data['mime_type']};base64,{img_data['base64']}"
            })

        return [HumanMessage(content=content_parts)]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((Exception,)),
        before_sleep=lambda retry_state: logger.warning(
            f"⚠️  Retry attempt {retry_state.attempt_number} after error"
        )
    )
    def invoke_with_retry(self, messages: List[HumanMessage]):
        """
        Invoke LLM with exponential backoff retry logic

        Args:
            messages: List of messages to send

        Returns:
            Response from LLM
        """
        try:
            return self.llm.invoke(messages)
        except Exception as e:
            logger.error(f"❌ LLM invocation error: {e}")
            raise

    def safe_invoke(self, messages: List[HumanMessage], fallback_response: str = None):
        """
        Safe invocation with fallback

        Args:
            messages: Messages to send
            fallback_response: Fallback response if all retries fail

        Returns:
            Response or fallback
        """
        try:
            return self.invoke_with_retry(messages)
        except Exception as e:
            logger.error(f"❌ All retry attempts failed: {e}")
            if fallback_response:
                logger.info(f"🔄 Using fallback response")

                class FallbackResponse:
                    def __init__(self, content):
                        self.content = content
                return FallbackResponse(fallback_response)
            raise
