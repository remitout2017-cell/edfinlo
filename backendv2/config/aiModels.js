// config/aiModels.js - MODEL TIERING
module.exports = {
  // For high-accuracy tasks (bank statements, KYC)
  highAccuracy: {
    model: "gemini-1.5-pro",
    maxTokens: 16384,
    costPerKInput: 1.25, // $ per 1K tokens
    costPerKOutput: 5.0,
  },

  // For medium tasks (salary slips, ITR)
  mediumAccuracy: {
    model: "gemini-1.5-flash",
    maxTokens: 8192,
    costPerKInput: 0.075,
    costPerKOutput: 0.3,
  },

  // For simple extraction
  lowAccuracy: {
    model: "gemini-1.5-flash-8b",
    maxTokens: 4096,
    costPerKInput: 0.0375,
    costPerKOutput: 0.15,
  },

  // Fallback (free tier alternative)
  fallback: {
    model: "gemini-1.0-pro",
    maxTokens: 2048,
    costPerKInput: 0.025,
    costPerKOutput: 0.05,
  },
};
