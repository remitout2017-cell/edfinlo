// routesv2/coBorrowerRoutes.js

const express = require("express");
const router = express.Router();
const coBorrowerController = require("../controllersv2/coBorrowerController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/imageUpload");

// Create co-borrower with AI KYC extraction
router.post(
  "/create",
  protect,
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "panFront", maxCount: 1 },
  ]),
  coBorrowerController.createCoBorrowerV2
);

// Create co-borrower manually (no AI)
router.post(
  "/create-manual",
  protect,
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "panFront", maxCount: 1 },
  ]),
  coBorrowerController.createCoBorrowerManualV2
);

// Upload financial documents
router.post(
  "/:coBorrowerId/financial",
  protect,
  upload.fields([
    { name: "salarySlips", maxCount: 6 },
    { name: "bankStatement", maxCount: 10 },
    { name: "itrDocuments", maxCount: 3 },
    { name: "form16", maxCount: 2 },
  ]),
  coBorrowerController.uploadFinancialDocumentsV2
);

// Add salary slips manually
router.post(
  "/:coBorrowerId/salary-manual",
  protect,
  coBorrowerController.addSalarySlipsManualV2
);

// Get all co-borrowers
router.get("/", protect, coBorrowerController.getCoBorrowersV2);

// Delete co-borrower
router.delete("/:coBorrowerId", protect, coBorrowerController.deleteCoBorrowerV2);

module.exports = router;
