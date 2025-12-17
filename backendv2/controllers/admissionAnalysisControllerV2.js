// controllers/admissionAnalysisControllerV2.js - ENHANCED CONTROLLER WITH FAILURE PERSISTENCE

const fs = require("fs").promises;
const AdmissionLetter = require("../models/AdmissionLetter");
const Student = require("../models/students");
const {
  compressImage,
  uploadImageToCloudinary,
  deleteLocalFile,
  uploadPdfToCloudinary,
} = require("../services/imageService");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const {
  processAdmissionLetterV2,
} = require("../agents/admissionLetterAgenticWorkflowV2");

// 🧹 CLEANUP FILE
async function cleanupFile(filePath) {
  if (!filePath) return;
  try {
    await deleteLocalFile(filePath);
  } catch (err) {
    console.warn(`⚠️ Failed to cleanup ${filePath}:`, err.message);
  }
}

// Optional: can be extended later
async function recordAdmissionFailure(
  userId,
  extracted,
  validation,
  riskAssessment,
  error
) {
  try {
    console.log(`📝 Recording admission letter failure for user ${userId}`);
    // You can push an event, log to a collection, etc. For now we rely on AdmissionLetter "failed" records.
  } catch (dbError) {
    console.error("❌ Failed to record admission failure:", dbError.message);
  }
}

// 🚀 UPLOAD ADMISSION LETTER V2 - Enhanced with delete existing logic
exports.uploadAdmissionLetterV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  const user = req.user;

  let filePath = null;
  let workflowResult = null;
  let cloudUrl = null;

  try {
    // STEP 0: Input validation
    if (!user) {
      throw new AppError("Authentication required", 401);
    }

    if (!req.file) {
      throw new AppError("Admission letter file is required", 400);
    }

    filePath = req.file.path;
    const isPdf = req.file.mimetype.toLowerCase().includes("pdf");
    console.log(
      `📄 Processing admission letter for user ${user._id} (${
        isPdf ? "PDF" : "Image"
      })`
    );

    // STEP 1: Remove existing admission letter (any status)
    console.log("🔍 Checking for existing admission letter...");
    const existingAdmissionLetter = await AdmissionLetter.findOne({
      user: user._id,
    });

    if (existingAdmissionLetter) {
      console.log("⚠️ Existing admission letter found. Deleting...");
      await AdmissionLetter.findByIdAndDelete(existingAdmissionLetter._id);
      await Student.findByIdAndUpdate(user._id, {
        $unset: { Admissionletter: 1 },
      });
      console.log("✅ Old admission letter deleted successfully");
    } else {
      console.log("✅ No existing admission letter found");
    }

    // STEP 2: Upload to Cloudinary (temporary until we decide pass/fail)
    console.log("📤 Uploading admission letter to Cloudinary...");
    try {
      if (isPdf) {
        const buffer = await fs.readFile(filePath);
        cloudUrl = await uploadPdfToCloudinary(
          buffer,
          `admission_letters/${user._id}-${Date.now()}`
        );
      } else {
        const compressedBuffer = await compressImage(filePath);
        cloudUrl = await uploadImageToCloudinary(
          compressedBuffer,
          `admission_letters/${user._id}-${Date.now()}`
        );
      }

      await cleanupFile(filePath);
      console.log("✅ Uploaded to Cloudinary");
    } catch (uploadError) {
      await cleanupFile(filePath);
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    // STEP 3: Run Admission Letter Workflow V2
    console.log("🔄 Starting Admission Letter Workflow V2...");
    try {
      workflowResult = await processAdmissionLetterV2(
        cloudUrl,
        isPdf ? "pdf" : "image",
        {
          maxRetries: 2,
          enableImprovements: true,
        }
      );

      if (!workflowResult || !workflowResult.extractedData) {
        throw new Error("Workflow failed to extract data");
      }

      console.log("✅ Workflow completed successfully");
    } catch (workflowError) {
      console.error("❌ Workflow failed:", workflowError.message);
      await recordAdmissionFailure(user._id, null, null, null, workflowError);

      // Workflow failure – no DB record, Client must re-upload
      throw new AppError(
        `Admission letter processing failed: ${workflowError.message}`,
        422
      );
    }

    const {
      extractedData,
      validationResult,
      riskAssessment,
      improvementRecommendations,
    } = workflowResult;

    // ------------------------------------------------------------------
    // STEP 3.5: Handle validation / risk failures and EASE verification
    // ------------------------------------------------------------------
    const validationFailed =
      validationResult && validationResult.valid === false;
    // Easier verification: treat as hard fail only if NOT verified AND risk is high
    const hardRiskFail =
      riskAssessment &&
      riskAssessment.verified === false &&
      riskAssessment.riskLevel === "high";

    if (validationFailed || hardRiskFail) {
      // Store a FAILED record WITHOUT saving the Cloudinary URL into Mongo
      const failureDoc = await AdmissionLetter.create({
        user: user._id,
        status: "failed",
        failureReason:
          (riskAssessment && riskAssessment.reason) ||
          (validationResult && validationResult.criticalIssues?.join(", ")) ||
          "Admission letter validation/risk assessment failed",
        validationIssues: validationResult?.criticalIssues || [],
        riskIssues: riskAssessment?.issuesFound || [],
        universityName: extractedData.universityName || null,
        programName: extractedData.programName || null,
        intakeTerm: extractedData.intakeTerm || null,
        intakeYear: extractedData.intakeYear || null,
        country: extractedData.country || null,
        universityScore: riskAssessment?.universityScore,
        riskLevel: riskAssessment?.riskLevel,
        issuesFound: riskAssessment?.issuesFound || [],
        evaluationSource: "ai_workflow_v2",
        geminiSummary: validationResult?.overallConfidence || "N/A",
        groqSummary: riskAssessment?.reason || "N/A",
        extractedFields: {
          ...extractedData,
          validationResult,
          riskAssessment,
          improvementRecommendations,
        },
        verificationLevel: riskAssessment?.verificationLevel,
        universityReputation: riskAssessment?.universityReputation,
        loanApprovalFactors: riskAssessment?.loanApprovalFactors,
        strengths: riskAssessment?.strengths,
        documentAuthenticity: validationResult?.documentAuthenticity,
      });

      await recordAdmissionFailure(
        user._id,
        extractedData,
        validationResult,
        riskAssessment,
        new Error("Admission letter validation/risk check failed")
      );

      const duration = Date.now() - startTime;
      return res.status(422).json({
        success: false,
        error: "Admission letter validation/risk assessment failed",
        failureId: failureDoc._id,
        reason:
          riskAssessment?.reason ||
          validationResult?.criticalIssues?.join(", ") ||
          "Validation/risk assessment failed",
        validationIssues: validationResult?.criticalIssues || [],
        riskIssues: riskAssessment?.issuesFound || [],
        warnings: validationResult?.warnings || [],
        universityScore: riskAssessment?.universityScore,
        riskLevel: riskAssessment?.riskLevel,
        improvementRecommendations: improvementRecommendations || null,
        extracted: extractedData,
        processingTime: `${duration}ms`,
      });
    }

    // STEP 4: Save VERIFIED admission letter to database with V2 metadata
    console.log("💾 Saving admission letter to database...");
    try {
      const admissionLetter = await AdmissionLetter.create({
        user: user._id,
        status: "verified",
        admissionLetterUrl: cloudUrl,
        universityName: extractedData.universityName || "Unknown",
        programName: extractedData.programName || "Unknown",
        intakeTerm: extractedData.intakeTerm,
        intakeYear: extractedData.intakeYear,
        country: extractedData.country,
        universityScore: riskAssessment.universityScore,
        riskLevel: riskAssessment.riskLevel,
        issuesFound: riskAssessment.issuesFound || [],
        evaluationSource: "ai_workflow_v2",
        geminiSummary: validationResult.overallConfidence || "N/A",
        groqSummary: riskAssessment.reason || "N/A",
        extractedFields: {
          ...extractedData,
          validationResult,
          riskAssessment,
          improvementRecommendations,
        },
        verificationLevel: riskAssessment.verificationLevel,
        universityReputation: riskAssessment.universityReputation,
        loanApprovalFactors: riskAssessment.loanApprovalFactors,
        strengths: riskAssessment.strengths,
        documentAuthenticity: validationResult.documentAuthenticity,
      });

      // Update Student reference
      await Student.findByIdAndUpdate(user._id, {
        Admissionletter: admissionLetter._id,
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Admission Letter V2 pipeline completed in ${duration}ms`);

      return res.status(201).json({
        success: true,
        message: "Admission letter analyzed successfully (V2 Enhanced)",
        data: {
          id: admissionLetter._id,
          status: admissionLetter.status,
          admissionLetterUrl: admissionLetter.admissionLetterUrl,
          universityName: admissionLetter.universityName,
          programName: admissionLetter.programName,
          intakeTerm: admissionLetter.intakeTerm,
          intakeYear: admissionLetter.intakeYear,
          country: admissionLetter.country,
          universityScore: admissionLetter.universityScore,
          riskLevel: admissionLetter.riskLevel,
          verificationLevel: admissionLetter.verificationLevel,
          issuesFound: admissionLetter.issuesFound,
          strengths: admissionLetter.strengths,
          universityReputation: admissionLetter.universityReputation,
          loanApprovalFactors: admissionLetter.loanApprovalFactors,
          improvementRecommendations,
          evaluatedAt: admissionLetter.evaluatedAt,
          processingTime: `${duration}ms`,
          metadata: workflowResult.metadata,
        },
      });
    } catch (dbError) {
      console.error("❌ Database save failed:", dbError.message);
      throw new AppError(
        `Failed to save admission letter: ${dbError.message}`,
        500
      );
    }
  } catch (error) {
    console.error("❌ Admission Letter V2 upload error:", error.message);
    await cleanupFile(filePath);
    next(error);
  }
});

// 📥 GET ADMISSION LETTER (works for both verified & failed)
exports.getAdmissionLetterV2 = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const admissionLetter = await AdmissionLetter.findOne({ user: userId })
      .populate("user", "firstName lastName email")
      .lean();

    if (!admissionLetter) {
      throw new AppError("No admission letter found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Admission letter fetched successfully (V2)",
      data: admissionLetter,
    });
  } catch (error) {
    console.error("❌ Get admission letter V2 error:", error.message);
    next(error);
  }
});

// 🗑️ DELETE ADMISSION LETTER
exports.deleteAdmissionLetterV2 = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const admissionLetter = await AdmissionLetter.findOne({ user: userId });

    if (!admissionLetter) {
      throw new AppError("No admission letter found", 404);
    }

    await AdmissionLetter.findByIdAndDelete(admissionLetter._id);
    await Student.findByIdAndUpdate(userId, {
      $unset: { Admissionletter: 1 },
    });

    return res.status(200).json({
      success: true,
      message: "Admission letter deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete admission letter V2 error:", error.message);
    next(error);
  }
});
