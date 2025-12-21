// routes/students/coborrower.routes.js - COMPLETE PRODUCTION ROUTES
const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/imageUpload");
const kycController = require("../../controllers/students/coBorrowerKyc.controller");
const financialController = require("../../controllers/students/coBorrowerFinancial.controller");

// ============================================================================
// CO-BORROWER MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/coborrower/list
 * @desc    Get all co-borrowers for logged-in student (newest first)
 * @access  Private (Student only)
 * @returns Array of co-borrowers with basic info
 */
router.get("/list", auth, kycController.getAllCoBorrowers);

/**
 * @route   GET /api/coborrower/:coBorrowerId
 * @desc    Get single co-borrower full details
 * @access  Private (Student only - must own the co-borrower)
 * @returns Complete co-borrower profile with KYC and financial data
 */
router.get("/:coBorrowerId", auth, kycController.getCoBorrowerById);

/**
 * @route   DELETE /api/coborrower/:coBorrowerId
 * @desc    Soft delete a co-borrower (marks as deleted, doesn't remove from DB)
 * @access  Private (Student only - must own the co-borrower)
 * @returns Success message
 */
router.delete("/:coBorrowerId", auth, kycController.deleteCoBorrower);

// ============================================================================
// KYC VERIFICATION ROUTES
// ============================================================================

/**
 * @route   POST /api/coborrower/kyc/upload
 * @desc    Create NEW co-borrower + Upload KYC documents for verification
 * @access  Private (Student only)
 * @body    firstName, lastName, relationToStudent, email, phoneNumber, dateOfBirth
 * @files   aadhaar_front, aadhaar_back, pan_front, passport (optional)
 * @returns Co-borrower created with KYC status (verified/rejected)
 *
 * @notes   - Checks for duplicate email/phone/name
 *          - Calls Python AI server for KYC verification
 *          - Uploads documents to Cloudinary
 *          - Returns encrypted sensitive data (Aadhaar/PAN numbers)
 */
router.post(
  "/kyc/upload",
  auth,
  upload.fields([
    { name: "aadhaar_front", maxCount: 1 },
    { name: "aadhaar_back", maxCount: 1 },
    { name: "pan_front", maxCount: 1 },
    { name: "passport", maxCount: 1 },
  ]),
  kycController.submitCoBorrowerKyc
);

/**
 * @route   PUT /api/coborrower/:coBorrowerId/kyc/reverify
 * @desc    Re-verify KYC for EXISTING rejected/pending co-borrower
 * @access  Private (Student only - must own the co-borrower)
 * @files   aadhaar_front, aadhaar_back, pan_front, passport (optional)
 * @returns Updated co-borrower with new KYC status
 *
 * @notes   - Only works if current KYC status is rejected or pending
 *          - Blocks re-verification if already verified (fraud prevention)
 *          - Deletes old Cloudinary images before uploading new ones
 *          - Calls Python AI server for re-verification
 */
router.put(
  "/:coBorrowerId/kyc/reverify",
  auth,
  upload.fields([
    { name: "aadhaar_front", maxCount: 1 },
    { name: "aadhaar_back", maxCount: 1 },
    { name: "pan_front", maxCount: 1 },
    { name: "passport", maxCount: 1 },
  ]),
  kycController.reverifyKyc
);

// ============================================================================
// FINANCIAL DOCUMENTS ROUTES
// ============================================================================

/**
 * @route   POST /api/coborrower/:coBorrowerId/financial/upload
 * @desc    Upload financial documents (PDFs) for specific co-borrower
 * @access  Private (Student only - must own the co-borrower)
 * @files   salary_slips_pdf, bank_statement_pdf, itr_pdf_1, itr_pdf_2 (optional), form16_pdf (optional)
 * @returns Upload confirmation with document URLs
 *
 * @notes   - Requires KYC to be verified first
 *          - Uploads all PDFs to Cloudinary
 *          - Sets financial status to "pending"
 *          - Must call /financial/process afterwards for AI analysis
 */
router.post(
  "/:coBorrowerId/financial/upload",
  auth,
  upload.fields([
    { name: "salary_slips_pdf", maxCount: 1 },
    { name: "bank_statement_pdf", maxCount: 1 },
    { name: "itr_pdf_1", maxCount: 1 },
    { name: "itr_pdf_2", maxCount: 1 },
    { name: "form16_pdf", maxCount: 1 },
  ]),
  financialController.uploadFinancialDocuments
);

/**
 * @route   POST /api/coborrower/:coBorrowerId/financial/process
 * @desc    Process financial documents using Python AI server
 * @access  Private (Student only - must own the co-borrower)
 * @returns Financial analysis with FOIR, CIBIL estimate, income data
 *
 * @notes   - Downloads PDFs from Cloudinary
 *          - Sends to Python AI server for extraction and analysis
 *          - Calculates FOIR (Fixed Obligation to Income Ratio)
 *          - Estimates CIBIL score based on financial behavior
 *          - Updates financial summary
 *          - Takes 30-120 seconds depending on document size
 */
router.post(
  "/:coBorrowerId/financial/process",
  auth,
  financialController.processFinancialDocuments
);

/**
 * @route   GET /api/coborrower/:coBorrowerId/financial/status
 * @desc    Get financial verification status and summary
 * @access  Private (Student only - must own the co-borrower)
 * @returns Verification status, confidence score, FOIR, CIBIL, document statuses
 *
 * @notes   - Returns quick summary of financial verification
 *          - Shows which documents are processed/pending/failed
 *          - Includes confidence score and errors if any
 */
router.get(
  "/:coBorrowerId/financial/status",
  auth,
  financialController.getFinancialStatus
);

/**
 * @route   GET /api/coborrower/:coBorrowerId/financial/analysis
 * @desc    Get COMPLETE financial analysis with all extracted data
 * @access  Private (Student only - must own the co-borrower)
 * @returns Full AI analysis report with extracted data, FOIR breakdown, CIBIL factors
 *
 * @notes   - Returns detailed analysis from Python AI server
 *          - Includes extracted data from all documents
 *          - Shows positive/negative CIBIL factors
 *          - Returns processing metadata (session ID, timestamp)
 */
router.get(
  "/:coBorrowerId/financial/analysis",
  auth,
  financialController.getCompleteAnalysis
);

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = router;
