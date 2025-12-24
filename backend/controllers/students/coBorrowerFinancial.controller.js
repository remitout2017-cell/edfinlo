// controllers/students/coBorrowerFinancial.controller.js

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const crypto = require("crypto");

const config = require("../../config/config");
const CoBorrower = require("../../models/student/CoBorrower");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

// ============================ Helpers ============================

function safePublicId(userId, docKey) {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `coborrower_${userId}/${docKey}_${Date.now()}_${rnd}`;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

function cleanupMulterFiles(files = {}) {
  try {
    Object.values(files).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((f) => safeUnlink(f?.path));
    });
  } catch (_) {}
}

function pickCloudinaryDeleteJobs(publicIds = []) {
  const ids = Array.isArray(publicIds) ? publicIds.filter(Boolean) : [];
  return ids.map((publicId) =>
    deleteFromCloudinary({
      publicId,
      resourceType: "raw",
      type: "upload",
    })
  );
}

// ============================ Controllers ============================

/**
 * Upload + Auto-process (Python first, Cloudinary after success)
 * POST /api/coborrower/:coBorrowerId/financial/upload
 */
const uploadFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);
  if (coBorrower.kycStatus !== "verified")
    throw new AppError("KYC must be verified first", 400);

  const files = req.files || {};
  const requiredFiles = ["salary_slips_pdf", "bank_statement_pdf", "itr_pdf_1"];
  for (const key of requiredFiles) {
    if (!files[key]?.[0]?.path) {
      cleanupMulterFiles(files);
      throw new AppError(`Missing required file: ${key}`, 400);
    }
  }

  // Mark processing early
  coBorrower.financialVerificationStatus = "processing";
  coBorrower.financialVerificationErrors = [];
  await coBorrower.save();

  const pythonUrl =
    config.pythonFinancialServerUrl || "http://localhost:8000/api/analyze";

  // 1) Call Python with local multer files
  let apiResponse;
  try {
    const form = new FormData();
    form.append(
      "salary_slips_pdf",
      fs.createReadStream(files.salary_slips_pdf[0].path)
    );
    form.append(
      "bank_statement_pdf",
      fs.createReadStream(files.bank_statement_pdf[0].path)
    );
    form.append("itr_pdf_1", fs.createReadStream(files.itr_pdf_1[0].path));
    if (files.itr_pdf_2?.[0]?.path)
      form.append("itr_pdf_2", fs.createReadStream(files.itr_pdf_2[0].path));
    if (files.form16_pdf?.[0]?.path)
      form.append("form16_pdf", fs.createReadStream(files.form16_pdf[0].path));

    const response = await axios.post(pythonUrl, form, {
      headers: form.getHeaders(),
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    apiResponse = response.data;
  } catch (err) {
    cleanupMulterFiles(files);
    coBorrower.financialVerificationStatus = "failed";
    coBorrower.financialVerificationErrors = [err.message];
    await coBorrower.save();
    throw new AppError(`Python processing failed: ${err.message}`, 503);
  }

  if (apiResponse?.status && apiResponse.status !== "success") {
    cleanupMulterFiles(files);
    coBorrower.financialVerificationStatus = "failed";
    coBorrower.financialVerificationErrors = apiResponse?.errors?.length
      ? apiResponse.errors
      : [`Python returned status: ${apiResponse.status}`];
    await coBorrower.save();
    throw new AppError("Python processing returned non-success status", 503);
  }

  // 2) Upload PDFs to Cloudinary (only if Python ok)
  const uploaded = {};
  try {
    uploaded.salary_slips = await uploadToCloudinary(
      files.salary_slips_pdf[0].path,
      {
        filename: safePublicId(coBorrowerId, "salary_slips"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      }
    );

    uploaded.bank_statement = await uploadToCloudinary(
      files.bank_statement_pdf[0].path,
      {
        filename: safePublicId(coBorrowerId, "bank_statement"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      }
    );

    uploaded.itr_1 = await uploadToCloudinary(files.itr_pdf_1[0].path, {
      filename: safePublicId(coBorrowerId, "itr_1"),
      folder: "coborrower_financial_docs",
      resource_type: "raw",
      type: "upload",
    });

    if (files.itr_pdf_2?.[0]?.path) {
      uploaded.itr_2 = await uploadToCloudinary(files.itr_pdf_2[0].path, {
        filename: safePublicId(coBorrowerId, "itr_2"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      });
    }

    if (files.form16_pdf?.[0]?.path) {
      uploaded.form16 = await uploadToCloudinary(files.form16_pdf[0].path, {
        filename: safePublicId(coBorrowerId, "form16"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      });
    }
  } catch (err) {
    cleanupMulterFiles(files);
    await Promise.allSettled(
      Object.values(uploaded)
        .filter((u) => u?.public_id)
        .map((u) =>
          deleteFromCloudinary({
            publicId: u.public_id,
            resourceType: u.resource_type || "raw",
            type: u.type || "upload",
          })
        )
    );
    coBorrower.financialVerificationStatus = "failed";
    coBorrower.financialVerificationErrors = [
      `Cloudinary upload failed: ${err.message}`,
    ];
    await coBorrower.save();
    throw new AppError(`Cloudinary upload failed: ${err.message}`, 500);
  } finally {
    cleanupMulterFiles(files);
  }

  // 3) Save documents + analysis to DB
  coBorrower.financialDocuments = {
    salarySlips: {
      documentUrls: [uploaded.salary_slips.secure_url],
      cloudinaryPublicIds: [uploaded.salary_slips.public_id],
      uploadedAt: new Date(),
      status: "completed",
    },
    bankStatement: {
      documentUrls: [uploaded.bank_statement.secure_url],
      cloudinaryPublicIds: [uploaded.bank_statement.public_id],
      uploadedAt: new Date(),
      status: "completed",
    },
    itr1: {
      documentUrls: [uploaded.itr_1.secure_url],
      cloudinaryPublicIds: [uploaded.itr_1.public_id],
      uploadedAt: new Date(),
      status: "completed",
    },
    itr2: uploaded.itr_2
      ? {
          documentUrls: [uploaded.itr_2.secure_url],
          cloudinaryPublicIds: [uploaded.itr_2.public_id],
          uploadedAt: new Date(),
          status: "completed",
        }
      : undefined,
    form16: uploaded.form16
      ? {
          documentUrls: [uploaded.form16.secure_url],
          cloudinaryPublicIds: [uploaded.form16.public_id],
          uploadedAt: new Date(),
          status: "completed",
        }
      : undefined,
  };

  coBorrower.financialAnalysis = {
    sessionId: apiResponse.session_id || `proc_${Date.now()}`,
    processingTimeSeconds: apiResponse.processing_time_seconds || 0,
    timestamp: new Date(),
    extractedData: apiResponse.extracted_data || {},
    foir: apiResponse.foir || {},
    cibil: apiResponse.cibil || {},
    quality: apiResponse.quality || {},
    documentsProcessed: apiResponse.documents_processed || {},
    errors: apiResponse.errors || [],
    rawResponse: apiResponse,
  };

  coBorrower.financialVerificationStatus = "verified";
  coBorrower.financialVerifiedAt = new Date();
  coBorrower.financialVerificationConfidence = 0.95;
  coBorrower.financialVerificationErrors = [];

  if (typeof coBorrower.updateFinancialSummary === "function") {
    coBorrower.updateFinancialSummary();
  }

  await coBorrower.save();

  return res.status(200).json({
    success: true,
    message: "Uploaded, processed via Python, and stored successfully",
    coBorrowerId: coBorrower._id,
    status: coBorrower.financialVerificationStatus,
    summary: coBorrower.financialSummary,
  });
});

/**
 * Reset financial docs: delete from Cloudinary + clear DB fields
 * DELETE/POST /api/coborrower/:coBorrowerId/financial/reset
 */
const resetFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  }).select(
    "+financialDocuments.salarySlips.cloudinaryPublicIds " +
      "+financialDocuments.bankStatement.cloudinaryPublicIds " +
      "+financialDocuments.itr1.cloudinaryPublicIds " +
      "+financialDocuments.itr2.cloudinaryPublicIds " +
      "+financialDocuments.form16.cloudinaryPublicIds"
  );

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);

  const docs = coBorrower.financialDocuments || {};
  const deleteJobs = [
    ...pickCloudinaryDeleteJobs(docs.salarySlips?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.bankStatement?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.itr1?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.itr2?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.form16?.cloudinaryPublicIds),
  ];

  await Promise.allSettled(deleteJobs);

  coBorrower.financialDocuments = undefined;
  coBorrower.financialAnalysis = undefined;
  coBorrower.financialSummary = undefined;

  coBorrower.financialVerificationStatus = "pending";
  coBorrower.financialVerifiedAt = null;
  coBorrower.financialVerificationConfidence = null;
  coBorrower.financialVerificationErrors = [];

  await coBorrower.save();

  return res.status(200).json({
    success: true,
    message: "Financial documents + analysis cleared. You can re-upload now.",
    coBorrowerId: coBorrower._id,
    status: coBorrower.financialVerificationStatus,
  });
});

// In coBorrowerFinancial.controller.js - getFinancialStatus

const getFinancialStatus = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);

  // ✅ FIXED: Wrapped in 'data' object
  return res.json({
    success: true,
    data: {
      coBorrowerId,
      status: coBorrower.financialVerificationStatus,
      confidence: coBorrower.financialVerificationConfidence,
      documents: coBorrower.financialDocuments || {},
      summary: coBorrower.financialSummary,
      errors: coBorrower.financialVerificationErrors || [],
    },
  });
});

// In coBorrowerFinancial.controller.js - getCompleteAnalysis

const getCompleteAnalysis = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower?.financialAnalysis) {
    throw new AppError(
      "No analysis available. Upload financial documents first.",
      404
    );
  }

  // ✅ FIXED: Wrapped in 'data' object
  return res.json({
    success: true,
    data: {
      coBorrowerId,
      analysis: coBorrower.financialAnalysis,
      summary: coBorrower.financialSummary,
      status: coBorrower.financialVerificationStatus,
    },
  });
});

// Keep legacy route but discourage usage
const processFinancialDocuments = asyncHandler(async () => {
  throw new AppError(
    "Not needed anymore. Use POST /financial/upload (it auto-processes).",
    400
  );
});

module.exports = {
  uploadFinancialDocuments,
  resetFinancialDocuments,
  processFinancialDocuments,
  getFinancialStatus,
  getCompleteAnalysis,
};
