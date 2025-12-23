const rateLimit = require("express-rate-limit");

// Strict OTP limiter - for OTP-related routes only
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: "Too many OTP requests. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General auth limiter - for login/register (more lenient)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API limiter - for general API routes (very lenient)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { otpLimiter, authLimiter, apiLimiter };
