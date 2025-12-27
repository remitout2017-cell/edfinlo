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

// ✅ Retry helper with exponential backoff
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

// ✅ AI health check
async function checkAIHealth(url) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    return { healthy: true, data: response.data };
  } catch (error) {
    console.error("❌ [Health] AI agent health check failed:", error.message);
    return { healthy: false, error: error.message };
  }
}

// ✅ Call Python AI with robust error handling
async function callPythonFinancialAgent(files, pythonUrl, metadata = {}) {
  const { coBorrowerId, sessionId } = metadata;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🤖 [AI Agent] Starting financial document processing`);
  console.log(` URL: ${pythonUrl}`);
  console.log(` Co-Borrower: ${coBorrowerId}`);
  console.log(` Session: ${sessionId}`);
  console.log(
    ` Files: ${Object.keys(files)
      .map((k) => files[k]?.[0]?.originalname || k)
      .join(", ")}`
  );
  console.log(`${"=".repeat(80)}\n`);

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

  return await retryWithBackoff(
    async () => {
      const response = await axios.post(pythonUrl, form, {
        headers: {
          ...form.getHeaders(),
          "X-Session-Id": sessionId,
          "X-Co-Borrower-Id": coBorrowerId,
        },
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent || !progressEvent.total) return;
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          if (percentCompleted % 25 === 0) {
            console.log(`📤 [Upload] Progress: ${percentCompleted}%`);
          }
        },
      });

      console.log(`✅ [AI Agent] Processing complete`);
      console.log(` Status: ${response.data.status}`);
      console.log(
        ` Processing time: ${response.data.processing_time_seconds}s`
      );
      if (response.data.quality?.overall_confidence !== undefined) {
        console.log(
          ` Confidence: ${
            response.data.quality.overall_confidence > 1
              ? response.data.quality.overall_confidence.toFixed(1)
              : (response.data.quality.overall_confidence * 100).toFixed(1)
          }%`
        );
      }
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
 * Upload + Auto-process
 * POST /api/coborrower/:coBorrowerId/financial/upload
 */
const uploadFinancialDocuments = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;
  const files = req.files || {};

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 [Financial] New upload request`);
  console.log(` Student ID: ${studentId}`);
  console.log(` Co-Borrower ID: ${coBorrowerId}`);
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  // STEP 1: Validate Co-Borrower
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
  console.log(` KYC Status: ${coBorrower.kycStatus}`);

  // STEP 2: Validate Required Files
  const requiredFiles = ["salary_slips_pdf", "bank_statement_pdf", "itr_pdf_1"];
  for (const key of requiredFiles) {
    if (!files[key]?.[0]?.path) {
      cleanupMulterFiles(files);
      throw new AppError(`Missing required file: ${key}`, 400);
    }
  }

  console.log(`✅ [Validation] All required files present`);
  Object.entries(files).forEach(([key, fileArray]) => {
    if (fileArray[0]) {
      const sizeMB = (fileArray[0].size / (1024 * 1024)).toFixed(2);
      console.log(` ${key}: ${fileArray[0].originalname} (${sizeMB} MB)`);
    }
  });

  // STEP 3: Check AI Agent Health
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
  console.log(` Environment: ${healthCheck.data?.environment || "unknown"}`);
  console.log(
    ` Models: Gemini ${healthCheck.data?.models?.gemini}, Groq ${healthCheck.data?.models?.groq}`
  );

  // STEP 4: Mark as Processing
  coBorrower.financialVerificationStatus = "processing";
  coBorrower.financialVerificationErrors = [];
  await coBorrower.save();
  console.log(`🔄 [Status] Co-borrower marked as processing`);

  let apiResponse;
  const uploaded = {};

  try {
    // STEP 5: Call Python AI Agent
    try {
      const sessionId = `fin_${Date.now()}_${crypto
        .randomBytes(4)
        .toString("hex")}`;

      apiResponse = await callPythonFinancialAgent(files, pythonUrl, {
        coBorrowerId,
        sessionId,
      });

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

      coBorrower.financialVerificationStatus = "failed";
      coBorrower.financialVerificationErrors = [
        err.response?.data?.error || err.message,
      ];
      await coBorrower.save();

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

    // STEP 6: Upload to Cloudinary (after Python success)
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
      console.log(` ✅ Salary slips uploaded`);

      uploaded.bank_statement = await uploadToCloudinary(
        files.bank_statement_pdf[0].path,
        {
          filename: safePublicId(coBorrowerId, "bank_statement"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        }
      );
      console.log(` ✅ Bank statement uploaded`);

      uploaded.itr_1 = await uploadToCloudinary(files.itr_pdf_1[0].path, {
        filename: safePublicId(coBorrowerId, "itr_1"),
        folder: "coborrower_financial_docs",
        resource_type: "raw",
        type: "upload",
      });
      console.log(` ✅ ITR 1 uploaded`);

      if (files.itr_pdf_2?.[0]?.path) {
        uploaded.itr_2 = await uploadToCloudinary(files.itr_pdf_2[0].path, {
          filename: safePublicId(coBorrowerId, "itr_2"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(` ✅ ITR 2 uploaded`);
      }

      if (files.form16_pdf?.[0]?.path) {
        uploaded.form16 = await uploadToCloudinary(files.form16_pdf[0].path, {
          filename: safePublicId(coBorrowerId, "form16"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(` ✅ Form 16 uploaded`);
      }

      if (files.cibil_pdf?.[0]?.path) {
        uploaded.cibil = await uploadToCloudinary(files.cibil_pdf[0].path, {
          filename: safePublicId(coBorrowerId, "cibil"),
          folder: "coborrower_financial_docs",
          resource_type: "raw",
          type: "upload",
        });
        console.log(` ✅ CIBIL report uploaded`);
      }

      console.log(
        `✅ [Cloudinary] All uploads complete (${
          Object.keys(uploaded).length
        } files)`
      );
    } catch (err) {
      console.error(`❌ [Cloudinary] Upload failed:`, err.message);
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

      throw new AppError(`Cloud storage upload failed: ${err.message}`, 500);
    } finally {
      cleanupMulterFiles(files);
    }

    // STEP 7: Save to Database
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

    // ✅ Map Python response into financialAnalysis
    const extracted = apiResponse.extracted_data || {};
    const itr = extracted.itr || {};
    const bank = extracted.bank_statement || {};
    const salary = extracted.salary_slips || {};

    coBorrower.financialAnalysis = {
      sessionId: apiResponse.session_id || `proc_${Date.now()}`,
      processingTimeSeconds: apiResponse.processing_time_seconds || 0,
      timestamp: new Date(),
      extractedData: {
        itr,
        bankStatement: bank,
        salarySlips: salary,
      },
      foir: {
        foirPercentage:
          apiResponse.foir?.foir_percentage ??
          apiResponse.foir?.foirPercentage ??
          0,
        foirStatus:
          apiResponse.foir?.foir_status ??
          apiResponse.foir?.foirStatus ??
          "unknown",
        monthlyNetIncome:
          apiResponse.foir?.monthly_net_income ??
          apiResponse.foir?.monthlyNetIncome ??
          0,
        totalMonthlyEmi:
          apiResponse.foir?.total_monthly_emi ??
          apiResponse.foir?.totalMonthlyEmi ??
          0,
        availableMonthlyIncome:
          apiResponse.foir?.available_monthly_income ??
          apiResponse.foir?.availableMonthlyIncome ??
          0,
      },
      cibil: {
        estimatedScore:
          apiResponse.cibil?.estimated_score ??
          apiResponse.cibil?.estimatedScore ??
          0,
        riskLevel:
          apiResponse.cibil?.risk_level ??
          apiResponse.cibil?.riskLevel ??
          "unknown",
        confidence: apiResponse.cibil?.confidence ?? 0,
        positiveFactors: apiResponse.cibil?.positive_factors || [],
        negativeFactors: apiResponse.cibil?.negative_factors || [],
      },
      quality: {
        overallConfidence:
          apiResponse.quality?.overall_confidence ??
          apiResponse.quality?.overallConfidence ??
          0,
        dataSourcesUsed: apiResponse.quality?.data_sources_used || [],
        missingData: apiResponse.quality?.missing_data || [],
      },
      documentsProcessed: apiResponse.documents_processed || {},
      errors: apiResponse.errors || [],
      rawResponse: apiResponse,
    };

    // Determine verification status based on confidence
    let confidence =
      coBorrower.financialAnalysis.quality.overallConfidence || 0;
    if (confidence > 1) {
      confidence = confidence / 100;
    }

    const missingData = coBorrower.financialAnalysis.quality.missingData || [];

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

    // ✅ Build financialSummary from extracted data
    const hasSalary = salary && Object.keys(salary).length > 0;
    const hasBank = bank && Object.keys(bank).length > 0;
    const hasItr = itr && Object.keys(itr).length > 0;
    const hasForm16 =
      extracted.form16 && Object.keys(extracted.form16).length > 0;

    let completenessScore = 0;
    if (coBorrower.kycStatus === "verified") completenessScore += 20;
    if (hasSalary) completenessScore += 20;
    if (hasBank) completenessScore += 20;
    if (hasItr) completenessScore += 30;
    if (hasForm16) completenessScore += 10;

    const foirData = coBorrower.financialAnalysis.foir;
    const cibilData = coBorrower.financialAnalysis.cibil;

    const overallScorePercent =
      coBorrower.financialAnalysis.quality.overallConfidence > 1
        ? coBorrower.financialAnalysis.quality.overallConfidence
        : (coBorrower.financialAnalysis.quality.overallConfidence || 0) * 100;

    coBorrower.financialSummary = {
      avgMonthlySalary:
        salary.average_net_salary ||
        salary.average_monthly_salary ||
        foirData.monthlyNetIncome ||
        0,
      avgMonthlyIncome: itr.average_monthly_income || 0,
      estimatedAnnualIncome:
        itr.average_annual_income || (itr.average_monthly_income || 0) * 12,

      totalExistingEmi: Math.round(bank.average_monthly_emi || 0),
      avgBankBalance: Math.round(bank.average_monthly_balance || 0),
      minBankBalance: Math.round(bank.minimum_balance || 0),

      bounceCount: bank.bounce_count || 0,
      dishonorCount: bank.dishonor_count || 0,
      insufficientFundIncidents: bank.insufficient_fund_incidents || 0,

      foir: Math.round(foirData.foirPercentage || 0),
      foirStatus: foirData.foirStatus || "unknown",

      cibilEstimate: cibilData.estimatedScore || 0,
      cibilRiskLevel: cibilData.riskLevel || "unknown",

      incomeStability:
        itr.income_growth_rate !== undefined
          ? itr.income_growth_rate < -30
            ? "unstable"
            : itr.income_growth_rate > 10
            ? "growing"
            : "stable"
          : salary.salary_consistency_months > 0
          ? "stable"
          : "unstable",

      overallScore: Math.round(overallScorePercent),

      documentCompleteness: {
        hasKYC: coBorrower.kycStatus === "verified",
        hasSalarySlips: hasSalary,
        hasBankStatement: hasBank,
        hasITR: hasItr,
        hasForm16: hasForm16,
        completenessScore,
      },

      verificationStatus: coBorrower.financialVerificationStatus,
      lastUpdated: new Date(),
      nextAction:
        coBorrower.financialVerificationStatus === "verified"
          ? "application_complete"
          : "complete_documents",
    };

    await coBorrower.save();

    console.log(`✅ [Database] All data saved successfully`);
    console.log(` Status: ${coBorrower.financialVerificationStatus}`);
    console.log(` Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(
      ` Monthly Income (FOIR): ₹${foirData.monthlyNetIncome?.toLocaleString(
        "en-IN"
      )}`
    );
    console.log(
      ` Monthly EMI: ₹${foirData.totalMonthlyEmi?.toLocaleString("en-IN")}`
    );
    console.log(
      ` Avg Bank Balance: ₹${coBorrower.financialSummary.avgBankBalance.toLocaleString(
        "en-IN"
      )}`
    );
    console.log(
      ` Min Bank Balance: ₹${coBorrower.financialSummary.minBankBalance.toLocaleString(
        "en-IN"
      )}`
    );
    console.log(` FOIR: ${foirData.foirPercentage}%`);
    console.log(` CIBIL Estimate: ${cibilData.estimatedScore || "N/A"}`);
    console.log(` Overall Score: ${coBorrower.financialSummary.overallScore}%`);
    console.log(
      ` Completeness Score: ${coBorrower.financialSummary.documentCompleteness.completenessScore}`
    );

    // STEP 8: Return Success Response
    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ [Success] Financial document processing complete`);
    console.log(` Session ID: ${apiResponse.session_id}`);
    console.log(` Processing Time: ${apiResponse.processing_time_seconds}s`);
    console.log(` FOIR: ${foirData.foirPercentage}%`);
    console.log(` FOIR Status: ${foirData.foirStatus}`);
    console.log(
      ` Monthly Income: ₹${foirData.monthlyNetIncome?.toLocaleString("en-IN")}`
    );
    console.log(
      ` Monthly EMI: ₹${foirData.totalMonthlyEmi?.toLocaleString("en-IN")}`
    );
    console.log(` CIBIL Estimate: ${cibilData.estimatedScore || "N/A"}`);
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
        foir: foirData,
        cibil: cibilData,
        quality: coBorrower.financialAnalysis.quality,
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
    console.error(`\n❌ [Error] Unexpected error:`, error);
    cleanupMulterFiles(files);

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
 * Reset financial docs
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
    `\n🗑️ [Reset] Clearing financial documents for: ${coBorrower.fullName}`
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
    console.log(` Deleting ${deleteJobs.length} files from Cloudinary...`);
    await Promise.allSettled(deleteJobs);
    console.log(` ✅ Cloudinary cleanup complete`);
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
    410
  );
});

module.exports = {
  uploadFinancialDocuments,
  resetFinancialDocuments,
  processFinancialDocuments,
  getFinancialStatus,
  getCompleteAnalysis,
};
