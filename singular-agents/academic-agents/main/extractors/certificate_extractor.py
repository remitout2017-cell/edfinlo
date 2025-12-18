from extractors.base_extractor import BaseExtractor
from schemas import Certificates, Certificate
from typing import Optional

class CertificateExtractor(BaseExtractor):
    """Extract certificate information"""
    
    PROMPT = """
Analyze this certificate image and extract:

1. Certificate name/title
2. Issuing organization/institution
3. Issue date (if visible)

Rate authenticity from 0-10 based on:
- Official seals/stamps (high importance)
- Professional design quality (low importance)

Be thorough and accurate.
"""
    
    def extract(self, image_path: str) -> Optional[Certificate]:
        """Extract single certificate"""
        print(f"🎓 Extracting certificate...")
        
        result = self.extract_structured(
            image_path=image_path,
            schema=Certificate,
            prompt=self.PROMPT
        )
        
        if result:
            print(f"   ✅ Certificate: {result.certificate_name}")
            print(f"      Issuer: {result.issuing_organization}")
            print(f"      Authenticity: {result.authenticity_score}/10")
        
        return result
    
    def extract_multiple(self, image_paths: list) -> Optional[Certificates]:
        """Extract multiple certificates from multiple images"""
        print(f"🎓 Extracting {len(image_paths)} certificates...")
        
        all_certificates = []
        
        for i, img_path in enumerate(image_paths):
            print(f"   Certificate {i+1}/{len(image_paths)}...")
            cert = self.extract(img_path)
            if cert:
                all_certificates.append(cert)
        
        if all_certificates:
            return Certificates(certificates=all_certificates)
        
        return None
