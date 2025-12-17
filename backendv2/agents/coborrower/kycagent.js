// agents/coborrower/kycAgent.js
const BaseAgent = require("./BaseAgent");

class KYCAgent {
  constructor() {
    this.agent = new BaseAgent("amazon/nova-2-lite-v1:free");
  }

  async extractAadhaar(images) {
    const prompt = `Extract Aadhaar details with high accuracy. Return ONLY JSON:

{
  "documentType": "aadhaar",
  "aadhaarNumber": "string (12 digits)",
  "name": "string",
  "dob": "DD/MM/YYYY",
  "gender": "Male/Female/Other",
  "address": "string",
  "confidence": 0.9,
  "extractedFields": {
    "number": { "value": "string", "confidence": 0.95 },
    "name": { "value": "string", "confidence": 0.95 },
    "dob": { "value": "string", "confidence": 0.95 },
    "address": { "value": "string", "confidence": 0.90 }
  }
}

RULES:
1. Aadhaar number must be exactly 12 digits
2. Name should be in proper case
3. Validate date format as DD/MM/YYYY
4. Address should include complete address
5. Return null for missing fields`;

    const content = [
      { type: "text", text: prompt },
      ...this.agent.createImageContent(images)
    ];

    const messages = [{ role: "user", content }];

    try {
      const response = await this.agent.invokeWithRetry(messages);
      return this.agent.parseResponse(response);
    } catch (error) {
      console.error("❌ Aadhaar extraction failed:", error.message);
      return this.getFallbackAadhaarData();
    }
  }

  async extractPAN(images) {
    const prompt = `Extract PAN card details with high accuracy. Return ONLY JSON:

{
  "documentType": "pan",
  "panNumber": "string (10 characters, format: ABCDE1234F)",
  "name": "string",
  "fatherName": "string",
  "dob": "DD/MM/YYYY",
  "confidence": 0.9,
  "extractedFields": {
    "panNumber": { "value": "string", "confidence": 0.98 },
    "name": { "value": "string", "confidence": 0.95 },
    "dob": { "value": "string", "confidence": 0.95 }
  }
}

VALIDATION RULES:
1. PAN format: 5 letters + 4 digits + 1 letter
2. Name should match Aadhaar if available
3. Validate date consistency with Aadhaar`;

    const content = [
      { type: "text", text: prompt },
      ...this.agent.createImageContent(images)
    ];

    const messages = [{ role: "user", content }];

    try {
      const response = await this.agent.invokeWithRetry(messages);
      return this.agent.parseResponse(response);
    } catch (error) {
      console.error("❌ PAN extraction failed:", error.message);
      return this.getFallbackPANData();
    }
  }

  async verifyKYC(aadhaarData, panData) {
    const prompt = `Verify KYC documents consistency. Return ONLY JSON:

{
  "verified": true/false,
  "confidence": 0.9,
  "issues": ["array of issues"],
  "warnings": ["array of warnings"],
  "matches": {
    "name": true/false,
    "dob": true/false,
    "overall": true/false
  },
  "verificationScore": 0.95
}

VERIFICATION RULES:
1. Name must match exactly (allow for middle name variations)
2. Date of birth must match exactly
3. PAN name should match Aadhaar name
4. Check for document tampering signs
5. Validate document authenticity`;

    const context = `Aadhaar Data: ${JSON.stringify(aadhaarData)}
PAN Data: ${JSON.stringify(panData)}`;

    const messages = [
      {
        role: "user",
        content: [{ type: "text", text: `${prompt}\n\n${context}` }],
      },
    ];

    try {
      const response = await this.agent.invokeWithRetry(messages);
      return this.agent.parseResponse(response);
    } catch (error) {
      console.error("❌ KYC verification failed:", error.message);
      return {
        verified: false,
        confidence: 0.1,
        issues: ["Verification failed"],
        warnings: [],
        matches: { name: false, dob: false, overall: false },
        verificationScore: 0.1
      };
    }
  }

  getFallbackAadhaarData() {
    return {
      documentType: "aadhaar",
      aadhaarNumber: null,
      name: null,
      dob: null,
      gender: null,
      address: null,
      confidence: 0.1,
      extractedFields: {
        number: { value: null, confidence: 0 },
        name: { value: null, confidence: 0 },
        dob: { value: null, confidence: 0 },
        address: { value: null, confidence: 0 }
      }
    };
  }

  getFallbackPANData() {
    return {
      documentType: "pan",
      panNumber: null,
      name: null,
      fatherName: null,
      dob: null,
      confidence: 0.1,
      extractedFields: {
        panNumber: { value: null, confidence: 0 },
        name: { value: null, confidence: 0 },
        dob: { value: null, confidence: 0 }
      }
    };
  }
}

module.exports = new KYCAgent();