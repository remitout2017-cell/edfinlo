// routes/students/coborrower.routes.js

const express = require("express");
const router = express.Router();

const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/imageUpload");

const kycController = require("../../controllers/students/coBorrowerKyc.controller");
const financialController = require("../../controllers/students/coBorrowerFinancial.controller");

// ---- Co-borrower basics
router.get("/list", auth, kycController.getAllCoBorrowers);
router.get("/:coBorrowerId", auth, kycController.getCoBorrowerById);
router.delete("/:coBorrowerId", auth, kycController.deleteCoBorrower);

// ---- KYC
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

// ---- Financial
router.post(
  "/:coBorrowerId/financial/upload",
  auth,
  upload.fields([
    { name: "salary_slips_pdf", maxCount: 1 },
    { name: "bank_statement_pdf", maxCount: 1 },
    { name: "itr_pdf_1", maxCount: 1 },
    { name: "itr_pdf_2", maxCount: 1 },
    { name: "form16_pdf", maxCount: 1 },
    { name: "cibil_pdf", maxCount: 1 },
  ]),
  financialController.uploadFinancialDocuments
);

// keep old process route (controller returns 400)
router.post(
  "/:coBorrowerId/financial/process",
  auth,
  financialController.processFinancialDocuments
);

// status + analysis
router.get(
  "/:coBorrowerId/financial/status",
  auth,
  financialController.getFinancialStatus
);
router.get(
  "/:coBorrowerId/financial/analysis",
  auth,
  financialController.getCompleteAnalysis
);

// reset: preferred DELETE + alias POST (for your Postman)
router.delete(
  "/:coBorrowerId/financial/reset",
  auth,
  financialController.resetFinancialDocuments
);
router.post(
  "/:coBorrowerId/financial/reset",
  auth,
  financialController.resetFinancialDocuments
);

module.exports = router;
