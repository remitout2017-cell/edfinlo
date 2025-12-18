from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from typing import Type, Optional
import base64
from pathlib import Path
from config import Config
import time


class BaseExtractor:
    """Base class for all extractors with Gemini structured output"""

    def __init__(self):
        self.gemini_available = bool(Config.GEMINI_API_KEY)
        self.use_fallback = False
        self.consecutive_failures = 0
        self.max_retries = 2

    def _get_model(self, timeout: int = 60):
        """
        Get Gemini model with OpenRouter fallback

        Args:
            timeout: Request timeout in seconds (default 60)
        """
        if self.use_fallback or not self.gemini_available:
            print("   🔄 Using OpenRouter (fallback)...")
            return ChatOpenAI(
                model=Config.OPENROUTER_MODEL,
                api_key=Config.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1,
                max_retries=1,
                request_timeout=timeout  # Add timeout
            )

        return ChatGoogleGenerativeAI(
            model=Config.GEMINI_MODEL,
            google_api_key=Config.GEMINI_API_KEY,
            temperature=0.1,
            max_retries=1,
            request_timeout=timeout  # Add timeout
        )

    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def extract_structured(self,
                           image_path: str,
                           schema: Type[BaseModel],
                           prompt: str,
                           timeout: int = 60) -> Optional[BaseModel]:
        """
        Extract data with structured output

        Args:
            image_path: Path to image
            schema: Pydantic model schema
            prompt: Extraction prompt
            timeout: Request timeout in seconds (default 60)

        Returns:
            Pydantic model instance or None
        """

        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                # Get model
                model = self._get_model(timeout=timeout)

                # Use with_structured_output for guaranteed format
                structured_llm = model.with_structured_output(schema)

                # Encode image
                base64_image = self._encode_image(image_path)

                # Create message
                message = HumanMessage(content=[
                    {"type": "text", "text": prompt},
                    {"type": "image_url",
                        "image_url": f"data:image/jpeg;base64,{base64_image}"}
                ])

                # Get structured response
                print(f"   ⏳ Sending request (timeout: {timeout}s)...")
                result = structured_llm.invoke([message])

                elapsed = time.time() - start_time
                print(f"   ✅ Response received in {elapsed:.1f}s")

                # Reset failure counter on success
                self.consecutive_failures = 0

                return result

            except Exception as e:
                error_str = str(e).lower()
                elapsed = time.time() - start_time

                print(
                    f"   ⚠️ Request failed after {elapsed:.1f}s: {str(e)[:100]}")

                # Check for quota errors
                if any(x in error_str for x in ["quota", "429", "rate limit", "resourceexhausted"]):
                    print(f"   🔄 Gemini quota exceeded, switching to OpenRouter...")
                    self.use_fallback = True
                    self.consecutive_failures = 0
                    continue  # Retry with fallback

                # Check for timeout errors
                if any(x in error_str for x in ["timeout", "timed out", "time out"]):
                    self.consecutive_failures += 1

                    if attempt < self.max_retries - 1:
                        # Increase timeout for next retry
                        new_timeout = timeout + 30
                        print(
                            f"   ⏰ Timeout occurred. Retrying with {new_timeout}s timeout...")
                        timeout = new_timeout
                        continue
                    else:
                        print(f"   ❌ Max retries reached. Skipping this extraction.")
                        return None

                # For other errors, fail fast
                if attempt < self.max_retries - 1:
                    print(f"   🔄 Retry {attempt + 1}/{self.max_retries}...")
                    time.sleep(2)  # Brief pause before retry
                    continue
                else:
                    print(
                        f"   ❌ Extraction failed after {self.max_retries} attempts")
                    return None

        return None
