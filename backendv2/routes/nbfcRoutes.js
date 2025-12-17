// routes/nbfcRoutes.js

const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  protect,
  restrictTo,
  requireAdminApproval,
} = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validationMiddleware");
const {
  registerNBFC,
  loginNBFC,
  verifyEmail,
  verifyPhone,
  resendEmailOTP,
  resendPhoneOTP,
  forgotPassword,
  resetPassword,
  getNBFCProfile,
  updateLoanConfig,
  updateNBFCProfile,
  getAllNBFCs,
  approveNBFC,
  toggleNBFCStatus,
} = require("../controllers/nbfcController");

// Validation chains
const registerValidation = [
  body("companyName")
    .trim()
    .notEmpty()
    .withMessage("Company name is required")
    .isLength({ min: 3 })
    .withMessage("Company name must be at least 3 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("phoneNumber")
    .optional()
    .trim()
    .matches(/^(?:\+91[\-\s]?)?[6-9]\d{9}$/)
    .withMessage("Valid phone number is required"),
  body("registrationNumber")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Registration number cannot be empty"),
  body("gstNumber")
    .optional()
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage("Valid GST number is required"),
  validate,
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required"),
  body("password").trim().notEmpty().withMessage("Password is required"),
  validate,
];

const verifyEmailValidation = [
  body("email").trim().isEmail().withMessage("Valid email is required"),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  validate,
];

const verifyPhoneValidation = [
  body("phoneNumber").trim().notEmpty().withMessage("Phone number is required"),
  body("otp").trim().notEmpty().withMessage("OTP is required"),
  validate,
];

// Public routes
router.post("/register", registerValidation, registerNBFC);
router.post("/login", loginValidation, loginNBFC);
router.post("/verify-email", verifyEmailValidation, verifyEmail);
router.post("/verify-phone", verifyPhoneValidation, verifyPhone);
router.post("/resend-email-otp", resendEmailOTP);
router.post("/resend-phone-otp", resendPhoneOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected NBFC routes
router.use(protect); // All routes below require authentication

router.get("/profile", restrictTo("NBFC"), getNBFCProfile);
router.put("/profile", restrictTo("NBFC"), updateNBFCProfile);
router.put(
  "/loan-config",
  restrictTo("NBFC"),
  requireAdminApproval,
  updateLoanConfig
);

// Admin-only routes
router.get("/all", restrictTo("admin"), getAllNBFCs);
router.put("/:id/approve", restrictTo("admin"), approveNBFC);
router.put("/:id/toggle-status", restrictTo("admin"), toggleNBFCStatus);

module.exports = router;
