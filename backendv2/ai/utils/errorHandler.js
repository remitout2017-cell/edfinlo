// AI-Specific Error Handling

export class AIError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AIError";
    this.provider = options.provider;
    this.model = options.model;
    this.attempt = options.attempt;
    this.originalError = options.originalError;
  }
}

export class RateLimitError extends AIError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter;
  }
}

export class ExtractionError extends AIError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ExtractionError";
    this.documentType = options.documentType;
  }
}

export class ValidationError extends AIError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ValidationError";
    this.validationErrors = options.validationErrors || [];
  }
}

/**
 * Handle AI provider errors
 */
export function handleAIError(error, context = {}) {
  const { provider, model, attempt } = context;

  // Rate limit errors
  if (
    error.status === 429 ||
    error.message?.toLowerCase().includes("rate limit")
  ) {
    const retryAfter = error.response?.headers?.["retry-after"] || 5;
    return new RateLimitError("Rate limit exceeded", {
      provider,
      model,
      attempt,
      retryAfter,
      originalError: error,
    });
  }

  // Timeout errors
  if (error.message?.toLowerCase().includes("timeout")) {
    return new AIError("Request timeout", {
      provider,
      model,
      attempt,
      originalError: error,
    });
  }

  // Network errors
  if (
    error.code === "ECONNRESET" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ENOTFOUND"
  ) {
    return new AIError("Network error", {
      provider,
      model,
      attempt,
      originalError: error,
    });
  }

  // Authentication errors
  if (error.status === 401 || error.status === 403) {
    return new AIError("Authentication failed - check API keys", {
      provider,
      model,
      originalError: error,
    });
  }

  // Server errors
  if (error.status >= 500) {
    return new AIError("Provider server error", {
      provider,
      model,
      attempt,
      originalError: error,
    });
  }

  // Generic AI error
  return new AIError(error.message || "Unknown AI error", {
    provider,
    model,
    attempt,
    originalError: error,
  });
}

/**
 * Get fallback data for extraction failure
 */
export function getExtractionFallback(documentType) {
  const fallbacks = {
    aadhaar: {
      documentType: "aadhaar",
      aadhaarNumber: null,
      name: null,
      dob: null,
      address: null,
      confidence: 0.1,
      error: "Extraction failed",
    },
    pan: {
      documentType: "pan",
      panNumber: null,
      name: null,
      dob: null,
      confidence: 0.1,
      error: "Extraction failed",
    },
    bankStatement: {
      accountDetails: {},
      monthlyAnalysis: [],
      overallAnalysis: {},
      confidence: 0.1,
      error: "Extraction failed",
    },
  };

  return (
    fallbacks[documentType] || {
      extracted: false,
      confidence: 0.1,
      error: "Extraction failed",
    }
  );
}
