// controllers/students/admission.controller.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const crypto = require("crypto");

const AdmissionLetter = require("../../models/student/AdmissionLetter");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

const ADMISSION_AGENT_URL =
  process.env.ADMISSION_AGENT_URL || "http://localhost:7000";

// Helper: Generate safe public ID for Cloudinary
function safePublicId(userId) {
  return `students_${userId}_admission_${Date.now()}_${crypto
    .randomBytes(6)
    .toString("hex")}`;
}

// Helper: Clean up temporary files
function cleanupTempFiles(files) {
  if (!files) return;

  const allFiles = Object.values(files).flat();
  allFiles.forEach((file) => {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      // Silently fail on cleanup errors
    }
  });
}

// Helper: Call Python admission agent
async function callAdmissionAgent(files) {
  const form = new FormData();

  // Only admission letters
  if (files.admissionletters?.length) {
    files.admissionletters.forEach((file) => {
      form.append(
        "admissionletters",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
  } else {
    throw new AppError("admissionletters file is required", 400);
  }

  try {
    console.log(`🔗 Calling admission agent at: ${ADMISSION_AGENT_URL}`);

    const response = await axios.post(
      `${ADMISSION_AGENT_URL}/extract/admission-letter`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 300000, // 5 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ Admission agent response received");
    return response.data;
  } catch (error) {
    console.error("❌ Admission agent error:", error.message);

    let errorMessage = "Admission agent failed";
    if (error.response?.data?.detail) {
      errorMessage += `: ${error.response.data.detail}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    throw new AppError(errorMessage, 500);
  }
}

// Helper: Upload admission document to Cloudinary
async function uploadAdmissionDocument(filePath, userId) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(`File not found: ${filePath}`, 400);
  }

  const publicId = safePublicId(userId);

  try {
    const result = await uploadToCloudinary(filePath, {
      folder: `students/${userId}/admission`,
      resource_type: "raw",
      type: "authenticated",
      public_id: publicId,
    });

    return {
      url: result.secure_url || result.url,
      publicId: result.public_id || publicId,
      resourceType: result.resource_type || "raw",
      type: "authenticated",
    };
  } catch (error) {
    throw new AppError(`Cloudinary upload failed: ${error.message}`, 500);
  }
}

// Helper: Delete previous admission from Cloudinary
async function deletePreviousAdmissionCloudinary(existingDoc) {
  const cloud = existingDoc?.extractedFields?.cloudinary;
  if (!cloud?.publicId) return;

  try {
    await deleteFromCloudinary(
      cloud.publicId,
      cloud.resourceType || "raw",
      cloud.type || "authenticated"
    );
  } catch (error) {
    console.error("⚠️ Cloudinary deletion error:", error.message);
  }
}

// Helper: Extract university ranking from data
function extractUniversityRanking(notes, rankingData) {
  const ranking = {
    qsWorldRanking: null,
    timesWorldRanking: null,
    usNewsRanking: null,
    rankingYear: null,
    rankingNotes: "",
  };

  // First, try rankingData from the agent response
  if (rankingData) {
    if (rankingData.qs_world_ranking !== undefined) {
      ranking.qsWorldRanking = rankingData.qs_world_ranking;
    }
    if (rankingData.times_world_ranking !== undefined) {
      ranking.timesWorldRanking = rankingData.times_world_ranking;
    }
    if (rankingData.us_news_ranking !== undefined) {
      ranking.usNewsRanking = rankingData.us_news_ranking;
    }
    if (rankingData.ranking_year) {
      ranking.rankingYear = rankingData.ranking_year;
    }
    if (rankingData.ranking_notes) {
      ranking.rankingNotes = rankingData.ranking_notes.substring(0, 500);
    }
  }

  // If no ranking data, try parsing from notes
  if (
    !ranking.qsWorldRanking &&
    !ranking.timesWorldRanking &&
    !ranking.usNewsRanking &&
    notes
  ) {
    const qsMatch = notes.match(/QS.*?[#:]?\s*(\d+)/i);
    const theMatch = notes.match(/THE.*?[#:]?\s*(\d+)/i);
    const usMatch = notes.match(/US News.*?[#:]?\s*(\d+)/i);
    const yearMatch = notes.match(/Year.*?[#:]?\s*(\d{4})/i);

    if (qsMatch) ranking.qsWorldRanking = parseInt(qsMatch[1]);
    if (theMatch) ranking.timesWorldRanking = parseInt(theMatch[1]);
    if (usMatch) ranking.usNewsRanking = parseInt(usMatch[1]);
    if (yearMatch) ranking.rankingYear = parseInt(yearMatch[1]);

    ranking.rankingNotes = notes.substring(0, 500);
  }

  // Return only if we have at least one ranking
  return ranking.qsWorldRanking ||
    ranking.timesWorldRanking ||
    ranking.usNewsRanking
    ? ranking
    : null;
}

// ========== CONTROLLER FUNCTIONS ==========

// POST /api/user/admission/submit
exports.submitAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized - User ID not found", 401);
  }

  // Check for required files
  if (!req.files?.admissionletters?.length) {
    throw new AppError("admissionletters file is required", 400);
  }

  // Ensure we don't process too many files
  if (req.files.admissionletters.length > 3) {
    throw new AppError("Maximum 3 admission letters allowed", 400);
  }

  let agentResponse = null;
  let uploadResult = null;

  try {
    console.log(`📤 Processing admission letter for user: ${userId}`);

    // Step 1: Call Python agent for extraction and scoring
    console.log("🔗 Calling Python agent...");
    agentResponse = await callAdmissionAgent(req.files);

    if (!agentResponse?.success || !agentResponse?.data) {
      throw new AppError(
        "Extraction failed - no data returned from agent",
        422
      );
    }

    // Step 2: Upload original document to Cloudinary
    console.log("☁️ Uploading to Cloudinary...");
    uploadResult = await uploadAdmissionDocument(
      req.files.admissionletters[0].path,
      userId
    );

    // Step 3: Extract data from agent response
    const record = agentResponse.data;
    const firstAdmission = record?.admission_letters?.[0] || {};
    const verification = record?.verifications?.[0] || {};
    const extractionMetadata = firstAdmission?.extraction_metadata || {};
    const rankingData = extractionMetadata?.ranking_data || {};

    // Step 4: Determine status
    let computedStatus = "pending";
    if (record?.status === "success" && (record?.valid_admissions ?? 0) > 0) {
      computedStatus = "verified";
    } else if (record?.status === "failed" || record?.errors?.length > 0) {
      computedStatus = "failed";
    }

    // Step 5: Extract university ranking
    const universityRanking = extractUniversityRanking(
      firstAdmission.notes,
      rankingData
    );

    // Step 6: Prepare the update document
    const updateData = {
      user: userId,
      status: computedStatus,
      admissionLetterUrl: uploadResult.url,

      // Core admission data
      universityName: firstAdmission.university_name || null,
      programName: firstAdmission.program_name || null,
      degreeLevel: firstAdmission.degree_level || null,
      intakeTerm: firstAdmission.intake_term || null,
      intakeYear: firstAdmission.intake_year || null,
      country: firstAdmission.country || null,
      city: firstAdmission.city || null,
      duration: firstAdmission.duration || null,

      // Financial information
      tuitionFee: firstAdmission.tuition_fee || null,
      tuitionCurrency: firstAdmission.tuition_currency || "USD",
      scholarshipAmount: firstAdmission.scholarship_amount || null,
      scholarshipMentioned: firstAdmission.scholarship_mentioned || false,

      // Deadlines
      acceptanceDeadline: firstAdmission.acceptance_deadline || null,
      enrollmentDeadline: firstAdmission.enrollment_deadline || null,
      feePaymentDeadline: firstAdmission.fee_payment_deadline || null,

      // Student information
      studentId: firstAdmission.student_id || null,
      applicationId: firstAdmission.application_id || null,

      // Conditional admission
      conditionalAdmission: firstAdmission.conditional_admission || false,
      conditions: firstAdmission.conditions || [],
      documentsRequired: firstAdmission.documents_required || [],

      // ========== UNIVERSITY SCORING DATA ==========
      universityScore: extractionMetadata?.university_score || null,
      riskLevel: extractionMetadata?.risk_level || "medium",
      issuesFound: extractionMetadata?.issues || [],
      strengths: extractionMetadata?.strengths || [],

      // Score breakdown
      scoreBreakdown: extractionMetadata?.score_breakdown || {
        ranking: 0,
        reputation: 0,
        admissionQuality: 0,
        countryFactor: 0,
      },

      // University ranking
      universityRanking: universityRanking,

      // Document authenticity
      documentAuthenticity: {
        score: firstAdmission.extraction_confidence || 0,
        confidence: firstAdmission.extraction_confidence || 0,
        factors: ["extraction_quality", "document_clarity"],
      },

      // Extraction metadata
      extractionConfidence: firstAdmission.extraction_confidence || 0,
      documentQuality: firstAdmission.document_quality || 0,
      notes: firstAdmission.notes || null,

      // Validation results
      validationIssues: verification.issues || [],
      riskIssues: verification.warnings || [],

      failureReason:
        Array.isArray(record?.errors) && record.errors.length > 0
          ? record.errors[0]
          : null,

      // Store full agent output
      extractedFields: {
        agentRecord: record,
        cloudinary: uploadResult,
        scoringData: extractionMetadata,
        savedAt: new Date(),
      },

      evaluationSource: "admission-agent-v2-scoring",
      evaluatedAt: new Date(),
      processingTimeSeconds: agentResponse.processing_time_seconds || 0,

      // Auto-calculated loan factors (will be populated by pre-save middleware)
      loanApprovalFactors: {
        eligibilityScore: extractionMetadata?.university_score || 0,
        riskFactors: extractionMetadata?.issues || [],
        recommendations: extractionMetadata?.strengths || [],
        decision: "pending",
      },
    };

    // Step 7: Find existing admission or create new
    console.log("💾 Saving to database...");

    // Delete previous admission if exists
    const existingAdmission = await AdmissionLetter.findOne({ user: userId });
    if (existingAdmission) {
      await deletePreviousAdmissionCloudinary(existingAdmission);
    }

    // Save the admission letter
    const savedAdmission = await AdmissionLetter.findOneAndUpdate(
      { user: userId },
      updateData,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    // Step 8: Link admission to student
    await Student.findByIdAndUpdate(userId, {
      $set: { admissionLetters: savedAdmission._id },
    });

    console.log("✅ Admission letter processed successfully");

    // Step 9: Prepare response
    const responseData = {
      _id: savedAdmission._id,
      status: savedAdmission.status,
      score: savedAdmission.universityScore,
      scoreCategory: savedAdmission.scoreCategory,
      riskLevel: savedAdmission.riskLevel,
      riskColor: savedAdmission.riskColor,

      universityInfo: {
        name: savedAdmission.universityName,
        program: savedAdmission.programName,
        country: savedAdmission.country,
        ranking: savedAdmission.universityRanking,
      },

      financialInfo: {
        tuition: savedAdmission.tuitionFee
          ? `${
              savedAdmission.tuitionCurrency
            } ${savedAdmission.tuitionFee.toLocaleString()}`
          : null,
        scholarship: savedAdmission.scholarshipMentioned,
        scholarshipAmount: savedAdmission.scholarshipAmount,
      },

      deadlines: {
        acceptance: savedAdmission.acceptanceDeadline,
        enrollment: savedAdmission.enrollmentDeadline,
        feePayment: savedAdmission.feePaymentDeadline,
        hasUpcoming: savedAdmission.hasUpcomingDeadlines,
        nextDeadline: savedAdmission.nextDeadline,
      },

      validation: {
        issues: savedAdmission.validationIssues,
        warnings: savedAdmission.riskIssues,
        confidence: savedAdmission.extractionConfidence,
      },

      scoring: {
        overall: savedAdmission.universityScore,
        breakdown: savedAdmission.scoreBreakdown,
        strengths: savedAdmission.strengths,
        issues: savedAdmission.issuesFound,
      },

      loanFactors: savedAdmission.loanApprovalFactors,

      processing: {
        time: agentResponse.processing_time_seconds || 0,
        source: savedAdmission.evaluationSource,
        evaluatedAt: savedAdmission.evaluatedAt,
      },
    };

    return res.status(200).json({
      success: true,
      message: "Admission letter processed successfully",
      processingTime: agentResponse.processing_time_seconds,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Admission processing error:", error.message);

    // Clean up uploaded file if error occurred
    if (uploadResult?.publicId) {
      try {
        await deleteFromCloudinary(
          uploadResult.publicId,
          uploadResult.resourceType,
          uploadResult.type
        );
      } catch (cleanupError) {
        console.error("⚠️ Failed to cleanup Cloudinary:", cleanupError.message);
      }
    }

    throw error; // Let error middleware handle it
  } finally {
    // Always clean up temp files
    cleanupTempFiles(req.files);
  }
});

// GET /api/user/admission/me
exports.getMyAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const admission = await AdmissionLetter.findOne({ user: userId })
    .populate("user", "name email phone")
    .lean();

  if (!admission) {
    throw new AppError("No admission letter found", 404);
  }

  // Add virtuals to response
  admission.scoreCategory =
    admission.universityScore >= 80
      ? "excellent"
      : admission.universityScore >= 70
      ? "good"
      : admission.universityScore >= 60
      ? "average"
      : admission.universityScore >= 50
      ? "below_average"
      : "poor";

  admission.riskColor =
    admission.riskLevel === "low"
      ? "#10b981"
      : admission.riskLevel === "medium_low"
      ? "#84cc16"
      : admission.riskLevel === "medium"
      ? "#f59e0b"
      : admission.riskLevel === "medium_high"
      ? "#f97316"
      : admission.riskLevel === "high"
      ? "#ef4444"
      : "#6b7280";

  admission.statusColor =
    admission.status === "verified"
      ? "#10b981"
      : admission.status === "pending"
      ? "#f59e0b"
      : admission.status === "failed"
      ? "#ef4444"
      : "#6b7280";

  admission.hasUpcomingDeadlines = !!(
    admission.acceptanceDeadline ||
    admission.enrollmentDeadline ||
    admission.feePaymentDeadline
  );

  return res.status(200).json({
    success: true,
    data: admission,
  });
});

// DELETE /api/user/admission/me
exports.deleteMyAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const admission = await AdmissionLetter.findOne({ user: userId });
  if (!admission) {
    throw new AppError("No admission letter found", 404);
  }

  // Delete from Cloudinary
  await deletePreviousAdmissionCloudinary(admission);

  // Delete from database
  await AdmissionLetter.deleteOne({ _id: admission._id });

  // Remove reference from student
  await Student.findByIdAndUpdate(userId, {
    $unset: { admissionLetters: "" },
  });

  return res.status(200).json({
    success: true,
    message: "Admission letter deleted successfully",
  });
});

// GET /api/user/admission/health
exports.healthCheck = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${ADMISSION_AGENT_URL}/health`, {
      timeout: 5000,
    });

    return res.status(200).json({
      success: true,
      message: "Admission agent is reachable",
      agentStatus: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Admission agent is unreachable",
      error: error.message,
    });
  }
});

// GET /api/user/admission/analysis (Score analysis)
exports.getScoreAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const admission = await AdmissionLetter.findOne({ user: userId });
  if (!admission) {
    throw new AppError("No admission letter found", 404);
  }

  // Generate detailed analysis
  const analysis = {
    summary: {
      overallScore: admission.universityScore || 0,
      scoreCategory: admission.scoreCategory,
      riskLevel: admission.riskLevel,
      riskColor: admission.riskColor,
      verificationLevel: admission.verificationLevel,
      status: admission.status,
    },

    breakdown: admission.scoreBreakdown || {},

    rankings: admission.universityRanking
      ? {
          qs: admission.universityRanking.qsWorldRanking,
          the: admission.universityRanking.timesWorldRanking,
          usNews: admission.universityRanking.usNewsRanking,
          year: admission.universityRanking.rankingYear,
          notes: admission.universityRanking.rankingNotes,
        }
      : null,

    admissionDetails: {
      university: admission.universityName,
      program: admission.programName,
      country: admission.country,
      degreeLevel: admission.degreeLevel,
      intake: admission.intakeTerm
        ? `${admission.intakeTerm} ${admission.intakeYear}`
        : "N/A",
      tuition: admission.tuitionFee
        ? `${
            admission.tuitionCurrency || "USD"
          } ${admission.tuitionFee.toLocaleString()}`
        : "Not specified",
      conditional: admission.conditionalAdmission,
      documentsRequired: admission.documentsRequired || [],
    },

    strengths: admission.strengths || [],
    issues: admission.issuesFound || [],
    validationIssues: admission.validationIssues || [],

    documentQuality: {
      extractionConfidence: admission.extractionConfidence || 0,
      documentQuality: admission.documentQuality || 0,
      authenticityScore: admission.documentAuthenticity?.score || 0,
    },

    loanRecommendation: admission.loanApprovalFactors || {},

    processingInfo: {
      evaluatedAt: admission.evaluatedAt,
      processingTime: admission.processingTimeSeconds,
      source: admission.evaluationSource,
    },
  };

  res.status(200).json({
    success: true,
    data: analysis,
  });
});

// GET /api/user/admission/analysis/comparison (Score comparison)
exports.getScoreComparison = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const userAdmission = await AdmissionLetter.findOne({ user: userId });
  if (!userAdmission) {
    throw new AppError("No admission letter found", 404);
  }

  // Get comparison data
  const [countryAvg, globalAvg, scoreDistribution] = await Promise.all([
    AdmissionLetter.getCountryAverageScore(userAdmission.country || "Unknown"),
    AdmissionLetter.aggregate([
      { $match: { universityScore: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$universityScore" },
          count: { $sum: 1 },
        },
      },
    ]),
    AdmissionLetter.getScoreDistribution(),
  ]);

  const globalData = globalAvg[0] || { avgScore: 0, count: 0 };

  // Calculate percentile
  const calculatePercentile = (userScore, avgScore) => {
    if (userScore >= 80) return 90;
    if (userScore >= 70) return 75;
    if (userScore >= 60) return 50;
    if (userScore >= 50) return 30;
    return 10;
  };

  const comparison = {
    userScore: userAdmission.universityScore || 0,
    countryAverage: countryAvg.avgScore || 0,
    countryCount: countryAvg.count || 0,
    globalAverage: globalData.avgScore || 0,
    globalCount: globalData.count || 0,

    percentile: calculatePercentile(
      userAdmission.universityScore || 0,
      globalData.avgScore || 0
    ),

    comparison: {
      vsCountry:
        userAdmission.universityScore > (countryAvg.avgScore || 0)
          ? "above"
          : "below",
      vsGlobal:
        userAdmission.universityScore > (globalData.avgScore || 0)
          ? "above"
          : "below",
      countryDifference:
        (userAdmission.universityScore || 0) - (countryAvg.avgScore || 0),
      globalDifference:
        (userAdmission.universityScore || 0) - (globalData.avgScore || 0),
    },

    distribution: scoreDistribution,

    interpretation: {
      score:
        userAdmission.universityScore >= 75
          ? "Excellent candidate"
          : userAdmission.universityScore >= 65
          ? "Good candidate"
          : userAdmission.universityScore >= 55
          ? "Average candidate"
          : "Below average candidate",

      recommendation:
        userAdmission.universityScore >= 75
          ? "Strongly recommend approval"
          : userAdmission.universityScore >= 65
          ? "Recommend approval with standard verification"
          : userAdmission.universityScore >= 55
          ? "Recommend additional verification"
          : "Recommend comprehensive review",
    },
  };

  res.status(200).json({
    success: true,
    data: comparison,
  });
});
