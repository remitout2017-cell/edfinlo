const express = require("express");
const router = express.Router();

const auth = require("../../controllers/students/auth.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

// PUBLIC ROUTES
router.post("/register", auth.register);
router.post("/register/invite", auth.registerFromInvite);

router.post("/login", auth.login);

router.post("/verify-email", auth.verifyEmail);
router.post("/verify-phone", auth.verifyPhone);

router.post("/resend-email-otp", auth.resendEmailVerification);
router.post("/resend-phone-otp", auth.resendPhoneOTP);

router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password", auth.resetPassword);

// PROTECTED ROUTE EXAMPLE
router.get(
  "/me",
  authMiddleware,
  authorize("student", "admin", "consultant", "nbfc"),
  (req, res) => {
    res.json({ success: true, user: req.user });
  }
);

module.exports = router;
