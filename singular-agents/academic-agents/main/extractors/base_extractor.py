import base64
import time
from typing import Optional, Type

from pydantic import BaseModel

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from config import Config


class BaseExtractor:
    """Base class for all extractors with native JSON mode support"""

    def __init__(self):
        self.gemini_available = bool(Config.GEMINI_API_KEY)
        self.use_fallback = False
        self.consecutive_failures = 0
        self.max_retries = 2

    def _get_model(self, timeout: int = 60):
        """
        Get Gemini model with OpenRouter fallback
        """
        if self.use_fallback or not self.gemini_available:
            print("   🔄 Using OpenRouter (fallback)...")
            return ChatOpenAI(
                model=Config.OPENROUTER_MODEL,
                api_key=Config.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1,
                max_retries=1,
                request_timeout=timeout,
            )

        # Gemini 2.5 Flash with native JSON mode
        return ChatGoogleGenerativeAI(
            model=Config.GEMINI_MODEL,
            google_api_key=Config.GEMINI_API_KEY,
            temperature=0.1,
            max_retries=1,
            request_timeout=timeout,
        )

    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def extract_structured(
        self,
        image_path: str,
        schema: Type[BaseModel],
        prompt: str,
        timeout: int = 60,
    ) -> Optional[BaseModel]:
        """
        Extract data using LangChain's with_structured_output()
        This uses Gemini's native JSON mode for reliable structured output
        """

        for attempt in range(self.max_retries):
            start_time = time.time()

            try:
                model = self._get_model(timeout=timeout)

                # Use LangChain's structured output feature
                # This automatically uses Gemini's native JSON mode
                structured_llm = model.with_structured_output(schema)

                base64_image = self._encode_image(image_path)

                message = HumanMessage(
                    content=[
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        },
                    ]
                )

                print(f"   ⏳ Sending request (timeout: {timeout}s)...")

                # Invoke with structured output - returns Pydantic model directly
                result = structured_llm.invoke([message])

                elapsed = time.time() - start_time
                print(f"   ✅ Response received in {elapsed:.1f}s")

                return result

            except Exception as e:
                elapsed = time.time() - start_time
                print(f"   ⚠️ Request failed after {elapsed:.1f}s:\n{e}")

                error_str = str(e).lower()

                # Quota/rate-limit -> fallback
                if any(x in error_str for x in ["quota", "429", "rate limit", "resourceexhausted"]):
                    print("   🔄 Gemini quota exceeded, switching to OpenRouter...")
                    self.use_fallback = True
                    self.consecutive_failures = 0
                    continue

                # Timeout handling
                if any(x in error_str for x in ["timeout", "timed out", "time out"]):
                    self.consecutive_failures += 1
                    if attempt < self.max_retries - 1:
                        timeout = timeout + 30
                        print(
                            f"   ⏰ Timeout occurred. Retrying with {timeout}s timeout...")
                        continue
                    print("   ❌ Max retries reached due to timeouts.")
                    return None

                # Other errors -> retry then fail
                if attempt < self.max_retries - 1:
                    print(f"   🔄 Retry {attempt + 1}/{self.max_retries}...")
                    time.sleep(2)
                    continue

                print(
                    f"   ❌ Extraction failed after {self.max_retries} attempts")
                return None

        return None
