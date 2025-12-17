// Model Priority and Selection Strategy
import { AI_MODELS } from './aiModels.js';

export const MODEL_STRATEGIES = {
  // Extraction Strategy: Gemini Primary → OpenRouter Gemini → Claude Haiku
  EXTRACTION: [
    AI_MODELS.EXTRACTION_PRIMARY,
    AI_MODELS.EXTRACTION_FALLBACK,
    AI_MODELS.EXTRACTION_FALLBACK_2,
  ],

  // Verification Strategy: Groq Primary → OpenRouter Llama
  VERIFICATION: [
    AI_MODELS.VERIFICATION_PRIMARY,
    AI_MODELS.VERIFICATION_FALLBACK,
  ],

  // Vision Processing (for documents with images)
  VISION: [
    AI_MODELS.EXTRACTION_PRIMARY, // Gemini 2.0 Flash Exp
    AI_MODELS.EXTRACTION_FALLBACK, // OpenRouter Gemini
  ],

  // Text-only Processing
  TEXT_ONLY: [
    AI_MODELS.VERIFICATION_PRIMARY, // Groq Llama 3.3 70B
    AI_MODELS.VERIFICATION_FALLBACK, // OpenRouter Llama
  ],
};

export const FALLBACK_RULES = {
  // When to trigger fallback
  RATE_LIMIT: true, // Fallback on 429 errors
  TIMEOUT: true, // Fallback on timeout
  EMPTY_RESPONSE: true, // Fallback on empty/invalid responses
  JSON_PARSE_ERROR: true, // Fallback on JSON parsing failures
  
  // Retry configuration per provider
  MAX_RETRIES_PER_PROVIDER: 2,
  
  // Circuit breaker (if provider fails N times, skip for X minutes)
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT: 300000, // 5 minutes
};

export const MODEL_SELECTION_LOGIC = {
  // Select model based on document type
  selectForDocumentType(documentType) {
    switch (documentType) {
      case 'kyc':
      case 'salary':
      case 'bankStatement':
      case 'form16':
      case 'itr':
      case 'workExperience':
      case 'academic':
      case 'admission':
        return MODEL_STRATEGIES.EXTRACTION;
      
      case 'verification':
      case 'validation':
        return MODEL_STRATEGIES.VERIFICATION;
      
      default:
        return MODEL_STRATEGIES.EXTRACTION;
    }
  },

  // Select model based on task complexity
  selectForComplexity(complexity) {
    switch (complexity) {
      case 'high': // Multi-page documents, complex extraction
        return MODEL_STRATEGIES.EXTRACTION;
      
      case 'medium': // Single page, structured data
        return MODEL_STRATEGIES.VISION;
      
      case 'low': // Text-only validation
        return MODEL_STRATEGIES.TEXT_ONLY;
      
      default:
        return MODEL_STRATEGIES.EXTRACTION;
    }
  },
};
