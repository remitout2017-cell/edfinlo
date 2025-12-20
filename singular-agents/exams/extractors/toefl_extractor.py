from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from config import Config
from schemas import TOEFLScore
import traceback

class TOEFLExtractor:
    """Extract TOEFL scores from test report images"""
    
    def __init__(self):
        if Config.GEMINI_API_KEY:
            self.llm = ChatGoogleGenerativeAI(
                model=Config.GEMINI_MODEL,
                api_key=Config.GEMINI_API_KEY,
                temperature=0.1
            )
        else:
            raise ValueError("GEMINI_API_KEY required for TOEFL extraction")
    
    def extract(self, image_paths: List[str]) -> Optional[TOEFLScore]:
        """Extract TOEFL score from images"""
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert at extracting TOEFL test scores from official score reports.

Extract ALL visible information with HIGH PRECISION:

**Section Scores (0-30 each):**
- Reading score
- Listening score  
- Speaking score
- Writing score
- Total score (0-120)

**Test Details:**
- Test date (format: YYYY-MM-DD)
- Registration number / Test taker ID
- Test center name and location
- Score validity/expiration date

**Candidate Information:**
- Full name as printed
- Date of birth
- Email (if visible)

**IMPORTANT RULES:**
1. ONLY extract data that is clearly visible
2. Section scores must be 0-30, total must be 0-120
3. Use null for missing/unclear data
4. Date format: YYYY-MM-DD
5. Be precise - no guessing

Return structured JSON only."""),
                ("user", [
                    {"type": "text", "text": "Extract TOEFL score data from this official test report:"},
                    *[{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{self._encode_image(img)}"}} 
                      for img in image_paths]
                ])
            ])
            
            # Use with_structured_output for Pydantic model
            structured_llm = self.llm.with_structured_output(TOEFLScore)
            chain = prompt | structured_llm
            
            result = chain.invoke({})
            return result
            
        except Exception as e:
            print(f"❌ TOEFL extraction error: {e}")
            traceback.print_exc()
            return None
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        import base64
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
