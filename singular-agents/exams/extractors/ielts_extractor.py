from typing import List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from config import Config
from schemas import IELTSScore
import traceback

class IELTSExtractor:
    """Extract IELTS scores from test report images"""
    
    def __init__(self):
        if Config.GEMINI_API_KEY:
            self.llm = ChatGoogleGenerativeAI(
                model=Config.GEMINI_MODEL,
                api_key=Config.GEMINI_API_KEY,
                temperature=0.1
            )
        else:
            raise ValueError("GEMINI_API_KEY required for IELTS extraction")
    
    def extract(self, image_paths: List[str]) -> Optional[IELTSScore]:
        """Extract IELTS score from images"""
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert at extracting IELTS test scores from official Test Report Forms (TRF).

Extract ALL visible information with HIGH PRECISION:

**Band Scores (0.0-9.0, in 0.5 increments):**
- Listening band score
- Reading band score
- Writing band score
- Speaking band score
- Overall band score

**Test Details:**
- Test date (format: YYYY-MM-DD)
- Candidate number
- Test center name and location
- Test Report Form (TRF) number
- Test type (Academic / General Training)

**Candidate Information:**
- Full name as printed
- Date of birth
- Nationality
- First language

**IMPORTANT RULES:**
1. ONLY extract data that is clearly visible
2. Band scores: 0.0-9.0 in 0.5 increments only (e.g., 6.5, 7.0, 7.5)
3. Overall band = average of 4 sections, rounded to nearest 0.5
4. Use null for missing/unclear data
5. Date format: YYYY-MM-DD
6. Be precise - no guessing

Return structured JSON only."""),
                ("user", [
                    {"type": "text", "text": "Extract IELTS score data from this official Test Report Form:"},
                    *[{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{self._encode_image(img)}"}} 
                      for img in image_paths]
                ])
            ])
            
            structured_llm = self.llm.with_structured_output(IELTSScore)
            chain = prompt | structured_llm
            
            result = chain.invoke({})
            return result
            
        except Exception as e:
            print(f"❌ IELTS extraction error: {e}")
            traceback.print_exc()
            return None
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64"""
        import base64
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
