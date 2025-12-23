from extractors.base_extractor import BaseExtractor
from schemas import Certificates, Certificate
from typing import Optional


class CertificateExtractor(BaseExtractor):
    """Extract certificate information with native JSON mode"""

    PROMPT = """
Analyze this certificate image and extract the following information:

1. **certificate_name** (string, required): Full name/title of the certificate
2. **issuing_organization** (string, required): Organization/institution that issued it
3. **issue_date** (string, optional): Issue date if visible (format: YYYY-MM-DD or as shown)
4. **authenticity_score** (integer, required): Rate authenticity from 0-10 based on:
   - Official seals/stamps present (high importance)
   - Professional design quality (low importance)
   - Visible signatures (medium importance)
   - Clear organization branding (medium importance)

IMPORTANT INSTRUCTIONS:
- Extract EXACTLY what you see on the certificate
- Be accurate with certificate name and issuing organization
- If issue date is not visible, set it to null
- Be thorough in assessing authenticity
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
