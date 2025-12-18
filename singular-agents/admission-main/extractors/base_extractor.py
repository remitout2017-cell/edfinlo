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
    """Base class for admission letter extraction with Gemini/OpenRouter"""

    def __init__(self):
        self.gemini_available = bool(Config.GEMINI_API_KEY)
        self.openrouter_available = bool(Config.OPENROUTER_API_KEY)
        self.use_fallback = False
        self.consecutive_failures = 0
        self.max_retries = 3  # Increased retries

        print(f"🔧 Extractor initialized:")
        print(f"   Gemini: {'✅' if self.gemini_available else '❌'}")
        print(f"   OpenRouter: {'✅' if self.openrouter_available else '❌'}")

        if not self.gemini_available and not self.openrouter_available:
            raise ValueError(
                "❌ No API keys available! Add GEMINI_API_KEY or OPENROUTER_API_KEY to .env")

    def _get_model(self, timeout: int = 90):
        """Get AI model with proper fallback"""
        # Try OpenRouter first if Gemini is unavailable or we're using fallback
        if self.use_fallback or not self.gemini_available:
            if not self.openrouter_available:
                raise ValueError(
                    "❌ OpenRouter API key not available for fallback!")

            print("  🔄 Using OpenRouter...")
            return ChatOpenAI(
                model=Config.OPENROUTER_MODEL,
                api_key=Config.OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.1,
                max_retries=1,
                request_timeout=timeout
            )

        # Use Gemini
        print("  🤖 Using Gemini...")
        return ChatGoogleGenerativeAI(
            model=Config.GEMINI_MODEL,
            google_api_key=Config.GEMINI_API_KEY,
            temperature=0.1,
            max_retries=1,
            request_timeout=timeout
        )

    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        try:
            with open(image_path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
                # Check if image is too large (>20MB encoded)
                if len(encoded) > 20 * 1024 * 1024:
                    print("  ⚠️ Warning: Image is very large, may cause issues")
                return encoded
        except Exception as e:
            raise ValueError(f"Failed to encode image {image_path}: {e}")

    def extract_structured(self,
                           image_path: str,
                           schema: Type[BaseModel],
                           prompt: str,
                           timeout: int = 90) -> Optional[BaseModel]:
        """Extract data with structured output"""

        print(f"\n  🎯 Starting extraction from: {Path(image_path).name}")

        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                # Get model
                model = self._get_model(timeout=timeout)
                structured_llm = model.with_structured_output(schema)

                # Encode image
                print(f"  📦 Encoding image...")
                base64_image = self._encode_image(image_path)

                # Create message
                message = HumanMessage(content=[
                    {"type": "text", "text": prompt},
                    {"type": "image_url",
                        "image_url": f"data:image/jpeg;base64,{base64_image}"}
                ])

                print(
                    f"  ⏳ Sending request (attempt {attempt + 1}/{self.max_retries}, timeout: {timeout}s)...")
                result = structured_llm.invoke([message])

                elapsed = time.time() - start_time
                print(f"  ✅ Response received in {elapsed:.1f}s")
                self.consecutive_failures = 0

                # Validate result
                if result:
                    print(f"  ✅ Extraction successful!")
                    return result
                else:
                    print(f"  ⚠️ Empty result returned")
                    return None

            except Exception as e:
                error_str = str(e).lower()
                elapsed = time.time() - start_time

                print(f"\n  ❌ Request failed after {elapsed:.1f}s")
                print(f"  Error: {str(e)[:200]}")

                # Handle quota/rate limit errors
                if any(x in error_str for x in ["quota", "429", "rate limit", "resourceexhausted", "resource_exhausted"]):
                    print(f"  🔄 API quota exceeded!")
                    if not self.use_fallback and self.openrouter_available:
                        print(f"  🔄 Switching to OpenRouter fallback...")
                        self.use_fallback = True
                        self.consecutive_failures = 0
                        continue
                    else:
                        print(f"  ❌ No fallback available or already using fallback")
                        if attempt < self.max_retries - 1:
                            wait_time = (attempt + 1) * 5
                            print(f"  ⏳ Waiting {wait_time}s before retry...")
                            time.sleep(wait_time)
                            continue

                # Handle timeout errors
                if any(x in error_str for x in ["timeout", "timed out", "time out", "deadline"]):
                    self.consecutive_failures += 1
                    if attempt < self.max_retries - 1:
                        new_timeout = min(timeout + 30, 180)  # Max 180s
                        print(
                            f"  ⏰ Timeout occurred. Retrying with {new_timeout}s timeout...")
                        timeout = new_timeout
                        time.sleep(3)
                        continue

                # Handle invalid API key
                if any(x in error_str for x in ["invalid api key", "authentication", "unauthorized", "api_key"]):
                    print(f"  ❌ API Key Error!")
                    print(f"  💡 Check your .env file and verify API keys are correct")
                    if not self.use_fallback and self.openrouter_available:
                        print(f"  🔄 Trying fallback...")
                        self.use_fallback = True
                        continue
                    else:
                        return None

                # Handle network errors
                if any(x in error_str for x in ["connection", "network", "dns"]):
                    print(f"  🌐 Network error detected")
                    if attempt < self.max_retries - 1:
                        wait_time = (attempt + 1) * 3
                        print(
                            f"  ⏳ Waiting {wait_time}s for network recovery...")
                        time.sleep(wait_time)
                        continue

                # Generic retry for other errors
                if attempt < self.max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(
                        f"  🔄 Retrying in {wait_time}s... ({attempt + 2}/{self.max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ❌ All {self.max_retries} attempts failed")
                    print(f"  💡 Tips:")
                    print(f"     - Check if image contains readable text")
                    print(f"     - Verify API keys in .env file")
                    print(f"     - Check your internet connection")
                    print(f"     - Try with a different image")
                    return None

        return None
