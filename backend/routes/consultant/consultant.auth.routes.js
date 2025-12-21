// routes/consultant/consultant.auth.routes.js
const express = require("express");
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  resendOTP,
  getMe,
} = require("../../controllers/consultant/consultant.auth.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-otp", resendOTP);

// Protected routes
router.get("/me", authMiddleware, authorize("consultant"), getMe);

module.exports = router;
