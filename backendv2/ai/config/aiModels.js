export const AI_PROVIDERS = {
  GEMINI: "gemini",
  GROQ: "groq",
  OPENROUTER: "openrouter",
};

export const AI_MODELS = {
  EXTRACTION_PRIMARY: {
    provider: AI_PROVIDERS.GEMINI,
    model: "gemini-2.5-flash",
    maxTokens: 8192,
    temperature: 0.05,
    timeout: 120000,
    supportsVision: true,
    costPer1MTokens: 0.075, // $0.075 per 1M tokens
    speedRating: 10, // 10/10 fastest
    accuracyRating: 9.5, // 9.5/10 accuracy
  },
  EXTRACTION_FALLBACK: {
    provider: AI_PROVIDERS.OPENROUTER,
    model: "nvidia/nemotron-nano-12b-v2-vl:free", // Free tier Gemini via OpenRouter
    maxTokens: 8192,
    temperature: 0.05,
    timeout: 120000,
    supportsVision: true,
    costPer1MTokens: 0,
    speedRating: 9,
    accuracyRating: 9,
  },
  // Verification Models (Primary: Groq)
  VERIFICATION_PRIMARY: {
    provider: AI_PROVIDERS.GROQ,
    model: "llama-3.3-70b-versatile", // Best balance of speed & accuracy
    maxTokens: 2048,
    temperature: 0.2,
    timeout: 30000,
    supportsVision: false,
    costPer1MTokens: 0.59,
    speedRating: 10, // Fastest inference
    accuracyRating: 9,
  },
  VERIFICATION_FALLBACK: {
    provider: AI_PROVIDERS.OPENROUTER,
    model: "tngtech/deepseek-r1t2-chimera:free",
    maxTokens: 2048,
    temperature: 0.2,
    timeout: 60000,
    supportsVision: false,
    costPer1MTokens: 0.59,
    speedRating: 8,
    accuracyRating: 9,
  },
  LARGE_DOC_ANALYSIS: {
    provider: AI_PROVIDERS.GEMINI,
    model: "gemini-2.0-flash-exp",
    maxTokens: 16384,
    temperature: 0.05,
    timeout: 180000,
    supportsVision: true,
    costPer1MTokens: 0.075,
    speedRating: 10,
    accuracyRating: 9.5,
  },
};
export const AGENT_STATE_SCHEMA = {
  // Input
  images: [],
  documentType: "",
  options: {},

  // Processing State
  currentStep: "",
  attempts: 0,
  errors: [],

  // Extraction Results
  extractedData: null,
  extractionConfidence: 0,
  extractionProvider: "",

  // Validation Results
  validationResult: null,
  validationPassed: false,

  // Verification Results
  verificationResult: null,
  verified: false,

  // Metadata
  startTime: 0,
  processingTime: 0,
  providersUsed: [],
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 2000,
  MAX_DELAY: 30000,
  RATE_LIMIT_DELAY: 5000,
};
