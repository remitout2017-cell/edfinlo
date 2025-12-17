// routes/coBorrowerRoutes.js - UNIFIED APPROACH
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/imageUpload");
const { protect } = require("../middlewares/authMiddleware");

const {
  createCoBorrower, // This now handles ALL documents at once
  uploadBankStatements,
  getCoBorrowers,
  getCoBorrower,
  deleteCoBorrower,
} = require("../controllers/coBorrowerController");

// ============================================================================
// CREATE CO-BORROWER WITH ALL CORE DOCUMENTS (ONE REQUEST)
// ============================================================================
router.post(
  "/",
  protect,
  upload.fields([
    // KYC Documents
    { name: "aadhaarFront", maxCount: 5 },
    { name: "aadhaarBack", maxCount: 5 },
    { name: "panFront", maxCount: 5 },
    { name: "panBack", maxCount: 5 },

    // Salary Slips (3 months)
    { name: "salarySlip1", maxCount: 10 },
    { name: "salarySlip2", maxCount: 10 },
    { name: "salarySlip3", maxCount: 10 },

    // ITR (2 years)
    { name: "itr2024", maxCount: 20 },
    { name: "itr2023", maxCount: 20 },

    // Form 16 (2 years)
    { name: "form162024", maxCount: 20 },
    { name: "form162023", maxCount: 20 },
  ]),
  createCoBorrower
);

// ============================================================================
// BANK STATEMENTS (SEPARATE - UPLOADED LATER)
// ============================================================================
router.post(
  "/:coBorrowerId/bank-statements",
  protect,
  upload.array("bankStatements", 50),
  uploadBankStatements
);

// ============================================================================
// GET / DELETE OPERATIONS
// ============================================================================

// Get all co-borrowers
router.get("/", protect, getCoBorrowers);

// Get single co-borrower
router.get("/:coBorrowerId", protect, getCoBorrower);

// Delete co-borrower
router.delete("/:coBorrowerId", protect, deleteCoBorrower);

module.exports = router;
