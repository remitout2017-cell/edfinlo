// routes/students/student.auth.routes.js
const express = require("express");
const router = express.Router();
const {
  register,
  registerFromInvite,
  login,
  verifyEmail,
  verifyPhone,
  resendEmailOTP,
  resendPhoneOTP,
  forgotPassword,
  resetPassword,
  resendResetOTP,
  getGoogleAuthUrl, // ADD
  googleCallback,
  getMe,
} = require("../../controllers/students/auth.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

// ============ PUBLIC ROUTES ============

// Registration (both methods)
router.post("/register", register); // Self-registration
router.post("/register-from-invite", registerFromInvite); // Via consultant invitation

// Login
router.post("/login", login);

// Email Verification
router.post("/verify-email", verifyEmail);
router.post("/resend-email-otp", resendEmailOTP);

// Phone Verification
router.post("/verify-phone", verifyPhone);
router.post("/resend-phone-otp", resendPhoneOTP);
router.get("/google/url", getGoogleAuthUrl);
router.get("/google/callback", googleCallback);
// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-reset-otp", resendResetOTP);

// ============ PROTECTED ROUTES ============
router.get("/me", authMiddleware, authorize("student"), getMe);

module.exports = router;
