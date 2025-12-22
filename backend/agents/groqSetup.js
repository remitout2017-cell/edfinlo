// agents/groqSetup.js
const { ChatGroq } = require("@langchain/groq");

const createGroqLLM = (options = {}) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  return new ChatGroq({
    apiKey,
    model: options.model || "groq/compound", // Fast + accurate
    temperature: options.temperature || 0.2, // Low for consistency
    maxTokens: options.maxTokens || 4000,
    streaming: false,
  });
};

module.exports = { createGroqLLM };
