// controllers/students/coBorrowerFinancial.controller.js (ENHANCED VERSION)

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

// ✅ NEW: Retry helper with exponential backoff
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 2,
    initialDelay = 3000,
    maxDelay = 10000,
    onRetry = () => {},
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) except 408, 429
      const status = error.response?.status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![408, 429].includes(status)
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(
          `⚠️ [Retry] Attempt ${
            attempt + 1
          }/${maxRetries} failed. Retrying in ${delay}ms...`
        );
        onRetry(attempt + 1, delay, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ✅ NEW: Check AI agent health
async function checkAIHealth(url) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    return { healthy: true, data: response.data };
  } catch (error) {
    console.error("❌ [Health] AI agent health check failed:", error.message);
    return { healthy: false, error: error.message };
  }
}

// ✅ NEW: Call Python AI with enhanced error handling
async function callPythonFinancialAgent(files, pythonUrl, metadata = {}) {
  const { coBorrowerId, sessionId } = metadata;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🤖 [AI Agent] Starting financial document processing`);
  console.log(`   URL: ${pythonUrl}`);
  console.log(`   Co-Borrower: ${coBorrowerId}`);
  console.log(`   Session: ${sessionId}`);
  console.log(
    `   Files: ${Object.keys(files)
      .map((k) => files[k]?.[0]?.originalname || k)
      .join(", ")}`
  );
  console.log(`${"=".repeat(80)}\n`);

  // Build FormData
  const form = new FormData();

  // Required files
  form.append(
    "salary_slips_pdf",
    fs.createReadStream(files.salary_slips_pdf[0].path)
  );
  form.append(
    "bank_statement_pdf",
    fs.createReadStream(files.bank_statement_pdf[0].path)
  );
  form.append("itr_pdf_1", fs.createReadStream(files.itr_pdf_1[0].path));

  // Optional files
  if (files.itr_pdf_2?.[0]?.path)
    form.append("itr_pdf_2", fs.createReadStream(files.itr_pdf_2[0].path));
  if (files.form16_pdf?.[0]?.path)
    form.append("form16_pdf", fs.createReadStream(files.form16_pdf[0].path));
  if (files.cibil_pdf?.[0]?.path)
    form.append("cibil_pdf", fs.createReadStream(files.cibil_pdf[0].path));

  // Call with retry logic
  return await retryWithBackoff(
    async () => {
      const response = await axios.post(pythonUrl, form, {
        headers: {
          ...form.getHeaders(),
          "X-Session-Id": sessionId,
          "X-Co-Borrower-Id": coBorrowerId,
        },
        timeout: 300000, // 5 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          if (percentCompleted % 25 === 0) {
            console.log(`📤 [Upload] Progress: ${percentCompleted}%`);
          }
        },
      });

      console.log(`✅ [AI Agent] Processing complete`);
      console.log(`   Status: ${response.data.status}`);
      console.log(
        `   Processing time: ${response.data.processing_time_seconds}s`
      );
      console.log(
        `   Confidence: ${(
          response.data.quality?.overall_confidence * 100
        ).toFixed(1)}%`
      );

      return response.data;
    },
    {
      maxRetries: 2,
      initialDelay: 5000,
      onRetry: (attempt, delay, error) => {
        console.log(`⚠️ [AI Agent] Error: ${error.message}`);
        console.log(`🔄 [AI Agent] Retry attempt ${attempt} in ${delay}ms...`);
      },
    }
  );
}

// ============================ Controllers ============================

/**
 * ✅ ENHANCED: Upload + Auto-process (Python first, Cloudinary after success)
 * POST /api/coborrower/:coBorrowerId/financial/upload
 */
const uploadFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;
  const files = req.files || {};

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 [Financial] New upload request`);
  console.log(`   Student ID: ${studentId}`);
  console.log(`   Co-Borrower ID: ${coBorrowerId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  // ====================================================================
  // STEP 1: Validate Co-Borrower
  // ====================================================================
  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower) {
    cleanupMulterFiles(files);
    throw new AppError("Co-borrower not found", 404);
  }

  if (coBorrower.kycStatus !== "verified") {
    cleanupMulterFiles(files);
    throw new AppError("KYC must be verified first", 400);
  }

  console.log(`✅ [Validation] Co-borrower validated: ${coBorrower.fullName}`);
  console.log(`   KYC Status: ${coBorrower.kycStatus}`);

  // ====================================================================
  // STEP 2: Validate Required Files
  // ====================================================================
  const requiredFiles = ["salary_slips_pdf", "bank_statement_pdf", "itr_pdf_1"];
  for (const key of requiredFiles) {
    if (!files[key]?.[0]?.path) {
      cleanupMulterFiles(files);
      throw new AppError(`Missing required file: ${key}`, 400);
    }
  }

  console.log(`✅ [Validation] All required files present`);

  // Log file sizes
  Object.entries(files).forEach(([key, fileArray]) => {
    if (fileArray[0]) {
      const sizeMB = (fileArray[0].size / (1024 * 1024)).toFixed(2);
      console.log(`   ${key}: ${fileArray[0].originalname} (${sizeMB} MB)`);
    }
  });

  // ====================================================================
  // STEP 3: Check AI Agent Health
  // ====================================================================
  const pythonUrl =
    config.pythonFinancialServerUrl || "http://localhost:8000/api/analyze";
  const baseUrl = pythonUrl.replace("/api/analyze", "");
  const healthCheck = await checkAIHealth(baseUrl);

  if (!healthCheck.healthy) {
    cleanupMulterFiles(files);
    throw new AppError(
      "AI processing service is currently unavailable. Please try again in a few minutes.",
      503
    );
  }

  console.log(`✅ [Health] AI agent is healthy and ready`);
  console.log(`   Environment: ${healthCheck.data?.environment || "unknown"}`);
  console.log(
    `   Models: Gemini ${healthCheck.data?.models?.gemini}, Groq ${healthCheck.data?.models?.groq}`
  );

  // ====================================================================
  // STEP 4: Mark as Processing
  // ====================================================================
  coBorrower.financialVerificationStatus = "processing";
  coBorrower.financialVerificationErrors = [];
  await coBorrower.save();

  console.log(`🔄 [Status] Co-borrower marked as processing`);

  let apiResponse;
  const uploaded = {};

  try {
    // ==================================================================
    // STEP 5: Call Python AI Agent (with retry logic)
    // ==================================================================
    try {
      const sessionId = `fin_${Date.now()}_${crypto
        .randomBytes(4)
        .toString("hex")}`;

      apiResponse = await callPythonFinancialAgent(files, pythonUrl, {
        coBorrowerId,
        sessionId,
      });

      // Validate response
      if (!apiResponse || apiResponse.status !== "success") {
        throw new Error(
          `Python returned non-success status: ${
            apiResponse?.status || "unknown"
          }`
        );
      }

      if (!apiResponse.extracted_data) {
        throw new Error("Missing extracted_data in Python response");
      }
    } catch (err) {
      cleanupMulterFiles(files);

      // Update status
      coBorrower.financialVerificationStatus = "failed";
      coBorrower.financialVerificationErrors = [
        err.response?.data?.error || err.message,
      ];
      await coBorrower.save();

      // Format error message
      let errorMessage = "AI document processing failed";
      if (err.code === "ECONNREFUSED") {
        errorMessage = "AI service is not running. Please contact support.";
      } else if (err.code === "ETIMEDOUT") {
        errorMessage =
          "AI processing timed out. Documents may be too large or complex.";
      } else if (err.response?.status === 400) {
        errorMessage = `Invalid document format: ${
          err.response.data?.error || err.message
        }`;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      throw new AppError(errorMessage, err.response?.status || 503);
    }

    // ==================================================================
    // STEP 6: Upload to Cloudinary (ONLY after Python success)
    // ==================================================================
    console.log(`\n🔵 [Cloudinary] Starting uploads...`);

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
      console.log(`   ✅ Salary slips uploaded`);

      uploaded.bank_statement = await uploadToCloudinary(
        files.bank_statement_pdf[0].path,
        {
          filename: safePublicId(coBorrowerId, "bank_statement"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        }
      );
      console.log(`   ✅ Bank statement uploaded`);

      uploaded.itr_1 = await uploadToCloudinary(files.itr_pdf_1[0].path, {
        filename: safePublicId(coBorrowerId, "itr_1"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      });
      console.log(`   ✅ ITR 1 uploaded`);

      // Optional files
      if (files.itr_pdf_2?.[0]?.path) {
        uploaded.itr_2 = await uploadToCloudinary(files.itr_pdf_2[0].path, {
          filename: safePublicId(coBorrowerId, "itr_2"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(`   ✅ ITR 2 uploaded`);
      }

      if (files.form16_pdf?.[0]?.path) {
        uploaded.form16 = await uploadToCloudinary(files.form16_pdf[0].path, {
          filename: safePublicId(coBorrowerId, "form16"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(`   ✅ Form 16 uploaded`);
      }

      if (files.cibil_pdf?.[0]?.path) {
        uploaded.cibil = await uploadToCloudinary(files.cibil_pdf[0].path, {
          filename: safePublicId(coBorrowerId, "cibil"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(`   ✅ CIBIL report uploaded`);
      }

      console.log(
        `✅ [Cloudinary] All uploads complete (${
          Object.keys(uploaded).length
        } files)`
      );
    } catch (err) {
      console.error(`❌ [Cloudinary] Upload failed:`, err.message);
      cleanupMulterFiles(files);

      // Rollback: delete any successfully uploaded files
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

      throw new AppError(`Cloud storage upload failed: ${err.message}`, 500);
    } finally {
      cleanupMulterFiles(files);
    }

    // ==================================================================
    // STEP 7: Save to Database
    // ==================================================================
    console.log(`\n💾 [Database] Saving analysis results...`);

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

    // Determine verification status based on confidence
    let confidence = apiResponse.quality?.overall_confidence || 0;

    // ✅ FIX: Convert percentage to decimal if needed (Python returns 0-100, DB expects 0-1)
    if (confidence > 1) {
      confidence = confidence / 100;
    }

    const missingData = apiResponse.quality?.missing_data || [];

    if (confidence >= 0.8 && missingData.length === 0) {
      coBorrower.financialVerificationStatus = "verified";
    } else if (confidence >= 0.6) {
      coBorrower.financialVerificationStatus = "partial";
    } else {
      coBorrower.financialVerificationStatus = "failed";
    }

    coBorrower.financialVerifiedAt = new Date();
    coBorrower.financialVerificationConfidence = confidence;
    coBorrower.financialVerificationErrors = apiResponse.errors || [];

    // Update financial summary
    if (typeof coBorrower.updateFinancialSummary === "function") {
      coBorrower.updateFinancialSummary();
    }

    await coBorrower.save();

    console.log(`✅ [Database] All data saved successfully`);
    console.log(`   Status: ${coBorrower.financialVerificationStatus}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

    // ==================================================================
    // STEP 8: Return Success Response
    // ==================================================================
    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ [Success] Financial document processing complete`);
    console.log(`   Session ID: ${apiResponse.session_id}`);
    console.log(`   Processing Time: ${apiResponse.processing_time_seconds}s`);
    console.log(`   FOIR: ${apiResponse.foir?.foir_percentage}%`);
    console.log(`   FOIR Status: ${apiResponse.foir?.foir_status}`);
    console.log(
      `   Monthly Income: ₹${apiResponse.foir?.monthly_net_income?.toLocaleString(
        "en-IN"
      )}`
    );
    console.log(
      `   Monthly EMI: ₹${apiResponse.foir?.total_monthly_emi?.toLocaleString(
        "en-IN"
      )}`
    );
    console.log(
      `   CIBIL Estimate: ${apiResponse.cibil?.estimated_score || "N/A"}`
    );
    console.log(
      `   Data Sources: ${
        apiResponse.quality?.data_sources_used?.join(", ") || "N/A"
      }`
    );
    if (missingData.length > 0) {
      console.log(`   ⚠️  Missing Data: ${missingData.join(", ")}`);
    }
    console.log(`${"=".repeat(80)}\n`);

    return res.status(200).json({
      success: true,
      message:
        "Financial documents uploaded, processed, and stored successfully",
      coBorrowerId: coBorrower._id,
      status: coBorrower.financialVerificationStatus,
      sessionId: apiResponse.session_id,
      processingTime: apiResponse.processing_time_seconds,
      summary: coBorrower.financialSummary,
      analysis: {
        foir: {
          percentage: apiResponse.foir?.foir_percentage,
          status: apiResponse.foir?.foir_status,
          monthlyIncome: apiResponse.foir?.monthly_net_income,
          monthlyEMI: apiResponse.foir?.total_monthly_emi,
          availableIncome: apiResponse.foir?.available_monthly_income,
        },
        cibil: {
          estimatedScore: apiResponse.cibil?.estimated_score,
          estimatedBand: apiResponse.cibil?.estimated_band,
          riskLevel: apiResponse.cibil?.risk_level,
          paymentHistoryScore: apiResponse.cibil?.payment_history_score,
          creditUtilizationScore: apiResponse.cibil?.credit_utilization_score,
          incomeStabilityScore: apiResponse.cibil?.income_stability_score,
          creditMixScore: apiResponse.cibil?.credit_mix_score,
          positiveFactors: apiResponse.cibil?.positive_factors || [],
          negativeFactors: apiResponse.cibil?.negative_factors || [],
        },
        quality: {
          overallConfidence: apiResponse.quality?.overall_confidence,
          dataSourcesUsed: apiResponse.quality?.data_sources_used,
          missingData: apiResponse.quality?.missing_data,
        },
      },
      nextSteps:
        coBorrower.financialVerificationStatus === "verified"
          ? [
              "Application ready for review",
              "All documents processed successfully",
            ]
          : [
              "Review missing data",
              "Upload better quality documents if needed",
            ],
    });
  } catch (error) {
    // This catch handles any unexpected errors not caught above
    console.error(`\n❌ [Error] Unexpected error:`, error);
    cleanupMulterFiles(files);

    // Cleanup any uploaded Cloudinary files
    if (Object.keys(uploaded).length > 0) {
      console.log(
        `🧹 [Cleanup] Rolling back ${
          Object.keys(uploaded).length
        } Cloudinary uploads...`
      );
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
    }

    throw error;
  }
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

  console.log(
    `\n🗑️  [Reset] Clearing financial documents for: ${coBorrower.fullName}`
  );

  const docs = coBorrower.financialDocuments || {};
  const deleteJobs = [
    ...pickCloudinaryDeleteJobs(docs.salarySlips?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.bankStatement?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.itr1?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.itr2?.cloudinaryPublicIds),
    ...pickCloudinaryDeleteJobs(docs.form16?.cloudinaryPublicIds),
  ];

  if (deleteJobs.length > 0) {
    console.log(`   Deleting ${deleteJobs.length} files from Cloudinary...`);
    await Promise.allSettled(deleteJobs);
    console.log(`   ✅ Cloudinary cleanup complete`);
  }

  coBorrower.financialDocuments = undefined;
  coBorrower.financialAnalysis = undefined;
  coBorrower.financialSummary = undefined;
  coBorrower.financialVerificationStatus = "pending";
  coBorrower.financialVerifiedAt = null;
  coBorrower.financialVerificationConfidence = null;
  coBorrower.financialVerificationErrors = [];

  await coBorrower.save();

  console.log(`✅ [Reset] Complete - Co-borrower ready for new upload\n`);

  return res.status(200).json({
    success: true,
    message:
      "Financial documents and analysis cleared successfully. You can upload new documents now.",
    coBorrowerId: coBorrower._id,
    status: coBorrower.financialVerificationStatus,
  });
});

/**
 * Get financial status
 * GET /api/coborrower/:coBorrowerId/financial/status
 */
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

  return res.json({
    success: true,
    data: {
      coBorrowerId,
      fullName: coBorrower.fullName,
      status: coBorrower.financialVerificationStatus,
      confidence: coBorrower.financialVerificationConfidence,
      verifiedAt: coBorrower.financialVerifiedAt,
      documents: coBorrower.financialDocuments || {},
      summary: coBorrower.financialSummary,
      errors: coBorrower.financialVerificationErrors || [],
    },
  });
});

/**
 * Get complete analysis
 * GET /api/coborrower/:coBorrowerId/financial/analysis
 */
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
      "No financial analysis available. Please upload financial documents first.",
      404
    );
  }

  return res.json({
    success: true,
    data: {
      coBorrowerId,
      fullName: coBorrower.fullName,
      analysis: coBorrower.financialAnalysis,
      summary: coBorrower.financialSummary,
      status: coBorrower.financialVerificationStatus,
      confidence: coBorrower.financialVerificationConfidence,
    },
  });
});

/**
 * @deprecated Use POST /financial/upload instead (auto-processes)
 */
const processFinancialDocuments = asyncHandler(async () => {
  throw new AppError(
    "This endpoint is deprecated. Use POST /api/coborrower/:id/financial/upload which automatically processes documents.",
    410 // Gone
  );
});

module.exports = {
  uploadFinancialDocuments,
  resetFinancialDocuments,
  processFinancialDocuments,
  getFinancialStatus,
  getCompleteAnalysis,
};
