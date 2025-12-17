// routes/loanRequestRoutes.js - UPDATED
const express = require("express");
const { body, query } = require("express-validator");
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validationMiddleware");
const {
  createLoanRequest,
  getNBFCRequests,
  getNBFCRequestById,
  decideLoanRequest,
  acceptLoanOffer,
  getStudentRequests, // <-- ADD THIS
} = require("../controllers/loanRequestController");

const router = express.Router();

router.use(protect);

// ---- Student routes ----

// Student sends request to NBFC
router.post(
  "/",
  restrictTo("student"),
  body("nbfcId").isMongoId().withMessage("Valid nbfcId is required"),
  validate,
  createLoanRequest
);

// Student accepts an approved offer
router.post("/:id/accept", restrictTo("student"), acceptLoanOffer);

// Student gets their own loan requests
router.get(
  "/student",
  restrictTo("student"),
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "cancelled"])
    .withMessage("Invalid status"),
  validate,
  getStudentRequests
);

// ---- NBFC routes ----

router.get(
  "/nbfc",
  restrictTo("NBFC"),
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Invalid status"),
  validate,
  getNBFCRequests
);

router.get("/nbfc/:id", restrictTo("NBFC"), getNBFCRequestById);

router.post(
  "/:id/decision",
  restrictTo("NBFC"),
  body("status")
    .isIn(["approved", "rejected"])
    .withMessage("Status must be 'approved' or 'rejected'"),
  validate,
  decideLoanRequest
);

module.exports = router;