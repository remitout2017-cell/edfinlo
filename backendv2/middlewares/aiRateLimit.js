// middlewares/aiRateLimit.js
const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");
const config = require("../config/config");

// Use Redis for distributed rate limiting in production
let redisClient;
if (config.env === "production") {
  redisClient = new Redis(config.redisUrl);
}

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req) => {
    // Different limits based on user role/plan
    if (req.user?.plan === 'premium') return 50;
    if (req.user?.plan === 'basic') return 20;
    return 10; // Free tier
  },
  message: {
    success: false,
    message: "Too many AI requests. Please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.user ? `ai:${req.user._id}` : `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many AI processing requests. Please wait 15 minutes.",
      code: "AI_RATE_LIMIT_EXCEEDED"
    });
  }
});

// Per-endpoint rate limiter
const bankStatementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 bank statement analyses per hour
  message: {
    success: false,
    message: "Bank statement analysis limit reached. Try again in an hour."
  }
});

module.exports = { aiRateLimiter, bankStatementLimiter };