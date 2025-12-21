// config/config.js
const path = require("path");
const dotenv = require("dotenv");

// Load .env once, from project root
dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const env = process.env;
const isDev = env.NODE_ENV === "development";

module.exports = {
  env: env.NODE_ENV || "development",
  isDev,
  port: Number(env.PORT) || 5000,

  academicurl: env.ACADEMIC_URL,

  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    groqApiKey2: env.GROQ_API_KEY2,
    gemeniApiKey: env.GEMENI_API_KEY,
    geminiRateLimit: Number(env.GEMINI_RATE_LIMIT) || 15,
    groqRateLimit: Number(env.GROQ_RATE_LIMIT) || 30,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    gemeniApiKey2: env.GEMENI_API_KEY2,

    // Timeouts (ms)
    geminiTimeout: Number(env.GEMINI_TIMEOUT) || 120000,
    groqTimeout: Number(env.GROQ_TIMEOUT) || 60000,

    // Temperatures
    geminiTemperature: Number(env.GEMINI_TEMPERATURE) || 0.05,
    groqTemperature: Number(env.GROQ_TEMPERATURE) || 0.1,
  },
  kycServerUrl:
    process.env.KYC_SERVER_URL || "http://localhost:5001/api/kyc/process",
  rateLimit: {
    windowMinutes: Number(env.RATE_LIMIT_WINDOW) || 15,
    maxRequests: Number(env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  encryptionKey: env.ENCRYPTION_KEY,
  mongoUri: env.MONGO_URI,

  jwt: {
    secret: env.JWT_SECRET,
    expire: env.JWT_EXPIRE || "7d",
  },

  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    secure: true,
  },

  otpDev: {
    apiKey: env.OTP_DEV_API_KEY,
    senderId: env.OTP_DEV_SENDER_ID,
    templateId: env.OTP_DEV_TEMPLATE_ID,
    codeLength: Number(env.OTP_CODE_LENGTH || 4),
  },
  redis: {
    url: env.REDIS_URL || "redis://localhost:6379",
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Python Financial Analysis Server URL
  pythonFinancialServerUrl:
    process.env.PYTHON_FINANCIAL_SERVER_URL ||
    "http://localhost:8000/api/analyze",
  email: {
    service: env.EMAIL_SERVICE || "gmail",
    host: env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(env.EMAIL_PORT) || 587,
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM,
  },

  frontendUrl: env.FRONTEND_URL,
  apiDocsUrl: env.API_DOCS_URL,
};
