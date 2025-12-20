from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from config import Config
from schemas import GREScore
import traceback

class GREExtractor:
    """Extract GRE scores from test report images"""
    
    def __init__(self):
        if Config.GEMINI_API_KEY:
            self.llm = ChatGoogleGenerativeAI(
                model=Config.GEMINI_MODEL,
                api_key=Config.GEMINI_API_KEY,
                temperature=0.1
            )
        else:
            raise ValueError("GEMINI_API_KEY required for GRE extraction")
    
    def extract(self, image_paths: List[str]) -> Optional[GREScore]:
        """Extract GRE score from images"""
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert at extracting GRE test scores from official score reports.

Extract ALL visible information with HIGH PRECISION:

**Section Scores:**
- Verbal Reasoning score (130-170)
- Quantitative Reasoning score (130-170)
- Analytical Writing score (0.0-6.0, in 0.5 increments)

**Test Details:**
- Test date (format: YYYY-MM-DD)
- Registration number / ETS ID
- Test center name and location
- Score validity date (5 years from test date)

**Test Taker Information:**
- Full name as printed
- Date of birth
- Email (if visible)

**IMPORTANT RULES:**
1. ONLY extract data that is clearly visible
2. Verbal/Quant scores: 130-170 only
3. Writing score: 0.0-6.0 in 0.5 increments
4. Use null for missing/unclear data
5. Date format: YYYY-MM-DD
6. Be precise - no guessing

Return structured JSON only."""),
                ("user", [
                    {"type": "text", "text": "Extract GRE score data from this official test report:"},
                    *[{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{self._encode_image(img)}"}} 
                      for img in image_paths]
                ])
            ])
            
            structured_llm = self.llm.with_structured_output(GREScore)
            chain = prompt | structured_llm
            
            result = chain.invoke({})
            return result
            
        except Exception as e:
            print(f"❌ GRE extraction error: {e}")
            traceback.print_exc()
            return None
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        import base64
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
