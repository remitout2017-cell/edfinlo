# base_chain.py - Add this debugging version

"""
Base Chain - DEBUGGING VERSION
✅ Detailed logging for LLM requests/responses
✅ Better error messages
✅ Validation of API responses
"""

import logging
from typing import List, Type, TypeVar, AsyncIterator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.globals import set_llm_cache
from langchain_core.caches import InMemoryCache
from pydantic import BaseModel, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential
from config import Config
import traceback
import json

logger = logging.getLogger(__name__)
T = TypeVar('T', bound=BaseModel)

# Enable LangChain caching globally
set_llm_cache(InMemoryCache())
logger.info("✅ LangChain In-Memory Cache Enabled")


class BaseChain:
    """Optimized base chain with extensive debugging"""

    def __init__(self, model_name: str = None, temperature: float = 0.0):
        """Initialize chain with Gemini 2.0 Flash + caching"""
        model_name = model_name or "gemini-2.0-flash-exp"

        try:
            # ✅ Validate API key first
            if not Config.GEMINI_API_KEY or len(Config.GEMINI_API_KEY) < 10:
                raise ValueError("Invalid or missing GEMINI_API_KEY")

            logger.debug(
                f"Initializing {self.__class__.__name__} with {model_name}")
            logger.debug(f"API Key length: {len(Config.GEMINI_API_KEY)} chars")

            self.llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=Config.GEMINI_API_KEY,
                temperature=temperature,
                max_output_tokens=8192,
                timeout=Config.TIMEOUT,
                max_retries=Config.MAX_RETRIES,
                streaming=True
            )

            logger.info(
                f"✅ Initialized {self.__class__.__name__} with {model_name}")
        except Exception as e:
            logger.error(
                f"❌ Failed to initialize {self.__class__.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise

    def create_gemini_content(self, prompt: str, images: List[dict]) -> List[HumanMessage]:
        """Create multimodal content for Gemini Vision"""
        logger.debug(f"Creating Gemini content with {len(images)} images")
        logger.debug(f"Prompt length: {len(prompt)} characters")

        content_parts = [{"type": "text", "text": prompt}]

        for i, img_data in enumerate(images):
            if 'base64' not in img_data or 'mime_type' not in img_data:
                logger.error(f"❌ Image {i} missing required fields")
                continue

            logger.debug(
                f"  Adding image {i+1}: {img_data['mime_type']}, {len(img_data['base64'])} chars")
            content_parts.append({
                "type": "image_url",
                "image_url": f"data:{img_data['mime_type']};base64,{img_data['base64']}"
            })

        return [HumanMessage(content=content_parts)]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def invoke_structured_with_retry(
        self,
        messages: List[HumanMessage],
        schema: Type[T]
    ) -> T:
        """Synchronous structured invocation with retry + caching"""
        try:
            logger.debug(f"🤖 Invoking LLM for {schema.__name__}")
            logger.debug(
                f"   Content parts: {len(messages[0].content) if messages else 0}")

            structured_llm = self.llm.with_structured_output(schema)
            result = structured_llm.invoke(messages)

            # ✅ Validate result is not None
            if result is None:
                raise ValueError(f"LLM returned None for {schema.__name__}")

            # ✅ Log extracted data summary
            logger.info(f"✅ Structured output validated: {schema.__name__}")
            if hasattr(result, 'extraction_confidence'):
                logger.debug(
                    f"   Confidence: {result.extraction_confidence:.0%}")

            return result

        except ValidationError as ve:
            logger.error(f"❌ Pydantic validation error for {schema.__name__}:")
            logger.error(f"   {ve}")
            logger.error(f"   Errors: {json.dumps(ve.errors(), indent=2)}")
            raise
        except Exception as e:
            logger.error(
                f"❌ Structured invocation failed for {schema.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def ainvoke_structured_with_retry(
        self,
        messages: List[HumanMessage],
        schema: Type[T]
    ) -> T:
        """ASYNC structured invocation with extensive debugging"""
        try:
            logger.debug(f"🤖 [ASYNC] Invoking LLM for {schema.__name__}")
            logger.debug(
                f"   Content parts: {len(messages[0].content) if messages else 0}")

            structured_llm = self.llm.with_structured_output(schema)
            result = await structured_llm.ainvoke(messages)

            # ✅ Validate result
            if result is None:
                raise ValueError(f"LLM returned None for {schema.__name__}")

            # ✅ DEBUG: Log the actual LLM response
            logger.debug(f"\n{'='*80}")
            logger.debug(f"📄 [DEBUG] LLM Response for {schema.__name__}:")
            try:
                result_dict = result.model_dump() if hasattr(result, 'model_dump') else result
                logger.debug(json.dumps(result_dict, indent=2, default=str)[
                             :1000])  # First 1000 chars
            except Exception as log_err:
                logger.warning(f"Could not log response: {log_err}")
            logger.debug(f"{'='*80}\n")

            logger.info(
                f"✅ [ASYNC] Structured output validated: {schema.__name__}")
            if hasattr(result, 'extraction_confidence'):
                logger.debug(
                    f"   Confidence: {result.extraction_confidence:.0%}")

            return result

        except ValidationError as ve:
            logger.error(
                f"❌ [ASYNC] Pydantic validation error for {schema.__name__}:")
            logger.error(f"   {ve}")
            logger.error(f"   Errors: {json.dumps(ve.errors(), indent=2)}")
            raise
        except Exception as e:
            logger.error(
                f"❌ [ASYNC] Structured invocation failed for {schema.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise

    async def astream_structured(
        self,
        messages: List[HumanMessage],
        schema: Type[T]
    ) -> AsyncIterator[str]:
        """Stream responses in real-time (better UX)"""
        try:
            structured_llm = self.llm.with_structured_output(schema)
            async for chunk in structured_llm.astream(messages):
                yield chunk
        except Exception as e:
            logger.error(f"❌ Streaming failed: {e}")
            logger.error(traceback.format_exc())
            raise
