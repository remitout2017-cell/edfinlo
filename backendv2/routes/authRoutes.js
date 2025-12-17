const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  verifyEmail,
  verifyPhone,
  resendEmailVerification,
  resendPhoneOTP,
  forgotPassword,
  resetPassword,
  registerFromInvite,
} = require("../controllers/authController");
const { validate } = require("../middlewares/validationMiddleware");

const router = express.Router();

// Registration validation (phone optional)
const validateRegistration = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .withMessage("Password: 8+ chars, upper, lower, number, special"),
  body("phoneNumber")
    .optional()
    .isMobilePhone()
    .withMessage("Valid phone required if provided"),
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name: 2+ chars"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name: 2+ chars"),
];

// Login validation
const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password required"),
];
router.post("/register-from-invite", registerFromInvite);

// Verify OTP validations
const validateVerifyEmail = [
  body("email").isEmail().withMessage("Valid email required"),
  body("otp")
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage("4-digit OTP required"),
];

const validateVerifyPhone = [
  body("phoneNumber")
    .optional()
    .isMobilePhone()
    .withMessage("Valid phone required"),
  body("otp")
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage("4-digit OTP required"),
];

const validateResendEmail = [
  body("email").isEmail().withMessage("Valid email required"),
];
const validateResendPhone = [
  body("phoneNumber")
    .isMobilePhone()
    .withMessage("Valid phone number required"),
];
const validateForgot = [
  body("email").isEmail().withMessage("Valid email required"),
];

const validateReset = [
  body("newPassword")
    .isLength({ min: 8 })
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .withMessage("Strong password required"),
  body("token").notEmpty().withMessage("Token required"),
];

// Routes
router.post("/register", validateRegistration, validate, register);
router.post("/login", validateLogin, validate, login);
router.post("/verify-email", validateVerifyEmail, validate, verifyEmail);
router.post("/verify-phone", validateVerifyPhone, validate, verifyPhone);
router.post(
  "/resend-email-verification",
  validateResendEmail,
  validate,
  resendEmailVerification
);
router.post("/resend-phone-otp", validateResendPhone, validate, resendPhoneOTP);
router.post("/forgot-password", validateForgot, validate, forgotPassword);
router.post("/reset-password", validateReset, validate, resetPassword);

module.exports = router;
