const rateLimit = require("express-rate-limit");

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

module.exports = { otpLimiter };
