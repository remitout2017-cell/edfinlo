// Dedicated KYC Cross-Verification Agent
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

export class KYCVerificationAgent {
  constructor() {
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);
    
    console.log('🔐 KYC Verification Agent initialized');
  }

  async verifyCrossDocuments(aadhaarData, panData, passportData = null) {
    console.log('🔐 Cross-verifying KYC documents...');
    
    const prompt = `Cross-verify KYC documents for consistency and authenticity. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": number (0-100),
  "nameConsistency": {
    "consistent": true|false,
    "variations": ["array of name variations found"],
    "matchScore": number (0-100),
    "reason": "explanation"
  },
  "dobConsistency": {
    "consistent": true|false,
    "dates": ["all DOBs found"],
    "matchScore": number (0-100),
    "reason": "explanation"
  },
  "documentAuthenticity": {
    "aadhaarValid": true|false,
    "panValid": true|false,
    "passportValid": true|false,
    "concerns": ["array of authenticity concerns"]
  },
  "identityConfirmed": true|false,
  "redFlags": ["array of serious concerns"],
  "recommendation": "approve|review|reject",
  "reasoning": "detailed explanation"
}

Aadhaar Data:
${JSON.stringify(aadhaarData, null, 2)}

PAN Data:
${JSON.stringify(panData, null, 2)}

${passportData ? `Passport Data:\n${JSON.stringify(passportData, null, 2)}` : ''}

VERIFICATION RULES:
1. Names must match (allow minor spelling variations)
2. Date of Birth must be identical across all documents
3. Aadhaar must be 12 digits
4. PAN must match format ABCDE1234F
5. Check for any suspicious patterns
6. Confirm identity can be established beyond reasonable doubt

BE STRICT on:
- DOB mismatches
- Major name differences (not just spelling)
- Invalid document formats

BE LENIENT on:
- Minor name spelling variations (e.g., "Kumar" vs "Kumarr")
- Middle name presence/absence
- Address differences (people move)`;

    try {
      let response;
      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn('⚠️ Primary verification failed, using fallback...');
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);
      
      console.log(`✅ KYC verification complete: ${verification.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      
      return verification;

    } catch (error) {
      console.error('❌ KYC verification failed:', error.message);
      
      // Fallback verification
      return {
        verified: false,
        confidence: 0,
        identityConfirmed: false,
        recommendation: 'review',
        reasoning: `Verification service failed: ${error.message}`,
        error: true,
      };
    }
  }

  async verifyWithGovernmentDB(panNumber, aadhaarNumber) {
    // Placeholder for actual government API integration
    console.log('🔍 Government DB verification (placeholder)...');
    
    // In production, integrate with:
    // - NSDL PAN Verification API
    // - UIDAI Aadhaar Verification API
    
    return {
      panVerified: false,
      aadhaarVerified: false,
      message: 'Government API integration not implemented',
    };
  }
}
