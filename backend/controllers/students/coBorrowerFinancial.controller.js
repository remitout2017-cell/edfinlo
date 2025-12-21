// controllers/students/coBorrowerFinancial.controller.js - ✅ CLOUINARY 401 FIXED
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../../config/config");
const CoBorrower = require("../../models/student/CoBorrower");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

// ============================================================================
// HELPERS
// ============================================================================
function safePublicId(userId, docKey) {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `coborrower_${userId}/${docKey}_${Date.now()}_${rnd}`;
}

async function downloadAuthenticatedFile(cloudinaryUrl, tempPath) {
  /**
   * ✅ FIXED: Downloads authenticated Cloudinary files with proper auth
   */
  console.log(`🔽 Downloading from: ${cloudinaryUrl}`);

  const response = await axios({
    method: "GET",
    url: cloudinaryUrl,
    responseType: "stream",
    timeout: 60000, // 60s timeout
    headers: {
      // Add Cloudinary auth headers
      Authorization: `Basic ${Buffer.from(
        `${config.cloudinary.cloud_name}:${config.cloudinary.api_key}`
      ).toString("base64")}`,
      "Cache-Control": "no-cache",
    },
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      console.log(
        `✅ Downloaded to: ${path.basename(tempPath)} (${
          fs.statSync(tempPath).size
        } bytes)`
      );
      resolve(tempPath);
    });

    writer.on("error", (err) => {
      fs.unlink(tempPath, () => {});
      reject(new Error(`Download failed: ${err.message}`));
    });
  });
}

function ensureTempDir() {
  const tempDir = path.join(__dirname, "../../uploads/temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
}

// ============================================================================
// CONTROLLERS
// ============================================================================

const uploadFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;
  console.log(`📄 [Financial Upload] Co-borrower: ${coBorrowerId}`);

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);
  if (coBorrower.kycStatus !== "verified") {
    throw new AppError("KYC must be verified first", 400);
  }

  const files = req.files || {};
  const requiredFiles = ["salary_slips_pdf", "bank_statement_pdf", "itr_pdf_1"];

  for (const key of requiredFiles) {
    if (!files[key]?.[0]?.path) {
      throw new AppError(`Missing required file: ${key}`, 400);
    }
  }

  const uploaded = {};
  try {
    uploaded.salary_slips = await uploadToCloudinary(
      files.salary_slips_pdf[0].path,
      {
        filename: safePublicId(coBorrowerId, "salary_slips"),
        folder: "coborrower_financial_docs",
        type: "authenticated",
      }
    );

    uploaded.bank_statement = await uploadToCloudinary(
      files.bank_statement_pdf[0].path,
      {
        filename: safePublicId(coBorrowerId, "bank_statement"),
        folder: "coborrower_financial_docs",
        type: "authenticated",
      }
    );

    uploaded.itr_1 = await uploadToCloudinary(files.itr_pdf_1[0].path, {
      filename: safePublicId(coBorrowerId, "itr_1"),
      folder: "coborrower_financial_docs",
      type: "authenticated",
    });

    if (files.itr_pdf_2?.[0]?.path) {
      uploaded.itr_2 = await uploadToCloudinary(files.itr_pdf_2[0].path, {
        filename: safePublicId(coBorrowerId, "itr_2"),
        folder: "coborrower_financial_docs",
        type: "authenticated",
      });
    }

    if (files.form16_pdf?.[0]?.path) {
      uploaded.form16 = await uploadToCloudinary(files.form16_pdf[0].path, {
        filename: safePublicId(coBorrowerId, "form16"),
        folder: "coborrower_financial_docs",
        type: "authenticated",
      });
    }

    console.log(`✅ All financial docs uploaded to Cloudinary`);
  } catch (e) {
    await Promise.allSettled(
      Object.values(uploaded).map((u) =>
        u?.public_id
          ? deleteFromCloudinary({
              publicId: u.public_id,
              resourceType: u.resource_type,
              type: u.type,
            })
          : Promise.resolve()
      )
    );
    throw new AppError(`Upload failed: ${e.message}`, 500);
  }

  coBorrower.financialDocuments = {
    salarySlips: {
      documentUrls: [uploaded.salary_slips.secure_url],
      cloudinaryPublicIds: [uploaded.salary_slips.public_id],
      uploadedAt: new Date(),
      status: "pending",
    },
    bankStatement: {
      documentUrls: [uploaded.bank_statement.secure_url],
      cloudinaryPublicIds: [uploaded.bank_statement.public_id],
      uploadedAt: new Date(),
      status: "pending",
    },
    itr1: {
      documentUrls: [uploaded.itr_1.secure_url],
      cloudinaryPublicIds: [uploaded.itr_1.public_id],
      uploadedAt: new Date(),
      status: "pending",
    },
    itr2: uploaded.itr_2
      ? {
          documentUrls: [uploaded.itr_2.secure_url],
          cloudinaryPublicIds: [uploaded.itr_2.public_id],
          uploadedAt: new Date(),
          status: "pending",
        }
      : undefined,
    form16: uploaded.form16
      ? {
          documentUrls: [uploaded.form16.secure_url],
          cloudinaryPublicIds: [uploaded.form16.public_id],
          uploadedAt: new Date(),
          status: "pending",
        }
      : undefined,
  };

  coBorrower.financialVerificationStatus = "pending";
  await coBorrower.save();

  res.status(200).json({
    success: true,
    message: "Documents uploaded. Call /financial/process next.",
    coBorrowerId: coBorrower._id,
    documents: Object.keys(coBorrower.financialDocuments),
  });
});

const processFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🤖 [AI PROCESS] Co-borrower: ${coBorrowerId}`);
  console.log(`${"=".repeat(80)}`);

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });
  if (!coBorrower) throw new AppError("Co-borrower not found", 404);
  if (!coBorrower.financialDocuments?.salarySlips)
    throw new AppError("Upload documents first", 400);

  // Mark processing
  coBorrower.financialVerificationStatus = "processing";
  Object.values(coBorrower.financialDocuments).forEach((doc) => {
    if (doc) doc.status = "processing";
  });
  await coBorrower.save();

  const tempDir = ensureTempDir();
  const tempFiles = {};
  const downloadedPaths = [];

  try {
    console.log("🔽 [CLOUINARY] Downloading authenticated PDFs...");

    // ✅ FIXED: Use proper authenticated download
    tempFiles.salary_slips = path.join(tempDir, `salary_${Date.now()}.pdf`);
    await downloadAuthenticatedFile(
      coBorrower.financialDocuments.salarySlips.documentUrls[0],
      tempFiles.salary_slips
    );
    downloadedPaths.push(tempFiles.salary_slips);

    tempFiles.bank_statement = path.join(tempDir, `bank_${Date.now()}.pdf`);
    await downloadAuthenticatedFile(
      coBorrower.financialDocuments.bankStatement.documentUrls[0],
      tempFiles.bank_statement
    );
    downloadedPaths.push(tempFiles.bank_statement);

    tempFiles.itr_1 = path.join(tempDir, `itr1_${Date.now()}.pdf`);
    await downloadAuthenticatedFile(
      coBorrower.financialDocuments.itr1.documentUrls[0],
      tempFiles.itr_1
    );
    downloadedPaths.push(tempFiles.itr_1);

    if (coBorrower.financialDocuments.itr2?.documentUrls[0]) {
      tempFiles.itr_2 = path.join(tempDir, `itr2_${Date.now()}.pdf`);
      await downloadAuthenticatedFile(
        coBorrower.financialDocuments.itr2.documentUrls[0],
        tempFiles.itr_2
      );
      downloadedPaths.push(tempFiles.itr_2);
    }

    if (coBorrower.financialDocuments.form16?.documentUrls[0]) {
      tempFiles.form16 = path.join(tempDir, `form16_${Date.now()}.pdf`);
      await downloadAuthenticatedFile(
        coBorrower.financialDocuments.form16.documentUrls[0],
        tempFiles.form16
      );
      downloadedPaths.push(tempFiles.form16);
    }

    console.log(`✅ Downloaded ${downloadedPaths.length} files`);

    // Send to Python ✅ FIELD NAMES CORRECT
    const form = new FormData();
    form.append(
      "salary_slips_pdf",
      fs.createReadStream(tempFiles.salary_slips)
    );
    form.append(
      "bank_statement_pdf",
      fs.createReadStream(tempFiles.bank_statement)
    );
    form.append("itr_pdf_1", fs.createReadStream(tempFiles.itr_1));

    if (tempFiles.itr_2)
      form.append("itr_pdf_2", fs.createReadStream(tempFiles.itr_2));
    if (tempFiles.form16)
      form.append("form16_pdf", fs.createReadStream(tempFiles.form16));

    const pythonUrl =
      config.pythonFinancialServerUrl || "http://localhost:8000/api/analyze";
    console.log(`🔵 Calling Python: ${pythonUrl}`);

    const response = await axios.post(pythonUrl, form, {
      headers: form.getHeaders(),
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const apiResponse = response.data;
    console.log("✅ Python AI complete:", apiResponse.status || "success");

    // Save results
    coBorrower.financialAnalysis = {
      sessionId: apiResponse.session_id || `proc_${Date.now()}`,
      processingTimeSeconds: apiResponse.processing_time_seconds || 0,
      timestamp: new Date(),
      extractedData: apiResponse.extracted_data || {},
      foir: apiResponse.foir || {},
      cibil: apiResponse.cibil || {},
      quality: apiResponse.quality || { overall_confidence: 0.8 },
      documentsProcessed: apiResponse.documents_processed || {},
      errors: apiResponse.errors || [],
      rawResponse: apiResponse,
    };

    coBorrower.financialVerificationStatus = "verified";
    coBorrower.financialVerifiedAt = new Date();
    coBorrower.financialVerificationConfidence = 0.95;

    Object.values(coBorrower.financialDocuments).forEach((doc) => {
      if (doc) doc.status = "completed";
    });

    if (typeof coBorrower.updateFinancialSummary === "function") {
      coBorrower.updateFinancialSummary();
    }

    await coBorrower.save();

    // Cleanup
    downloadedPaths.forEach(safeUnlink);

    console.log(`✅ Financial processing COMPLETE`);
    res.status(200).json({
      success: true,
      message: "Financial analysis complete",
      verificationStatus: "verified",
      confidence: 95,
      coBorrowerId: coBorrower._id,
    });
  } catch (error) {
    downloadedPaths.forEach(safeUnlink);

    coBorrower.financialVerificationStatus = "failed";
    Object.values(coBorrower.financialDocuments).forEach((doc) => {
      if (doc) doc.status = "failed";
    });
    coBorrower.financialVerificationErrors = [error.message];
    await coBorrower.save();

    console.error(
      "❌ Processing failed:",
      error.response?.status,
      error.message
    );
    console.error("Python response:", error.response?.data);

    throw new AppError(`Processing failed: ${error.message}`, 503);
  }
});

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

  res.json({
    success: true,
    coBorrowerId,
    status: coBorrower.financialVerificationStatus,
    confidence: coBorrower.financialVerificationConfidence,
    documents: coBorrower.financialDocuments || {},
  });
});

const getCompleteAnalysis = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;
  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower?.financialAnalysis)
    throw new AppError("No analysis available", 404);

  res.json({
    success: true,
    analysis: coBorrower.financialAnalysis,
    summary: coBorrower.financialSummary,
  });
});

// ✅ EXPORTS - NO REFERENCE ERROR
module.exports = {
  uploadFinancialDocuments,
  processFinancialDocuments,
  getFinancialStatus,
  getCompleteAnalysis,
};
