// controllers/kycdetailsuplodev2.js
const crypto = require("crypto");
const config = require("../config/config");
const {
  compressAndEncryptImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");
const { processKycDocumentsV3 } = require("../agents/kycAgenticWorkflowV3");
const Student = require("../models/students");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");

// 🔧 DATE PARSER (Helper)
function parseDate(dateStr) {
  if (!dateStr) return undefined;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (parts) {
    const [, day, month, year] = parts;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Try ISO Date
  const isoDate = new Date(dateStr);
  return isNaN(isoDate.getTime()) ? undefined : isoDate;
}

// 🔐 ENCRYPT TEXT (Helper)
function encryptText(text) {
  if (!text) return undefined;
  try {
    const key = Buffer.from(config.encryptionKey, "hex");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString(
      "hex"
    )}`;
  } catch (error) {
    console.error("❌ Encryption failed:", error.message);
    return undefined;
  }
}

// 🧹 CLEANUP FILES (Helper)
async function cleanupFiles(filePaths) {
  if (!filePaths || typeof filePaths !== "object") return;
  const cleanupPromises = Object.values(filePaths)
    .filter((fp) => fp && typeof fp === "string")
    .map((fp) =>
      deleteLocalFile(fp).catch((err) =>
        console.warn(`⚠️ Failed to cleanup ${fp}:`, err.message)
      )
    );
  await Promise.allSettled(cleanupPromises);
}

// 📊 RECORD KYC FAILURE (Helper)
async function recordKycFailure(
  userId,
  extracted,
  validation,
  verification,
  error
) {
  try {
    const failureData = {
      "kycData.lastVerifiedAt": new Date(),
      "kycData.verificationSource": "ai_workflow_v2",
      "kycData.verificationConfidence": verification?.confidence || 0,
      "kycData.verificationReason":
        verification?.reason ||
        validation?.criticalIssues?.join(", ") ||
        error.message ||
        "Unknown error",
      "kycData.extractedData": {
        aadhaarName: extracted?.aadhaarName || null,
        panName: extracted?.panName || null,
        passportName: extracted?.passportName || null,
      },
      "kycData.validationIssues": validation?.criticalIssues || [],
      "kycData.verificationIssues":
        verification?.identityConfirmation?.inconsistencies || [],
      "kycData.failedAt": new Date(),
      kycStatus: "rejected",
      kycVerifiedAt: null,
    };

    await Student.findByIdAndUpdate(
      userId,
      {
        $set: failureData,
        $inc: { "kycData.failureCount": 1 },
      },
      { runValidators: false }
    );
    console.log(`📝 Recorded KYC failure for user ${userId}`);
  } catch (dbError) {
    console.error("❌ Failed to record KYC failure:", dbError.message);
  }
}

// ============================================================================
// 🚀 MAIN CONTROLLER V2 - Enhanced Upload and Verification
// ============================================================================

exports.uploadDocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = {};
  let workflowResult = null;

  try {
    // ✅ STEP 0: Input Validation
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("No documents uploaded", 400);
    }

    // 🔧 FIX: Correctly extract just the file path string
    // This solves the "Received an instance of Object" error
    for (const key in req.files) {
      if (req.files[key]?.[0]?.path) {
        filePaths[key] = req.files[key][0].path;
      }
    }

    if (Object.keys(filePaths).length === 0) {
      throw new AppError("No valid document paths found", 400);
    }

    console.log(
      `📤 Processing ${Object.keys(filePaths).length} documents for user ${
        req.user._id
      }`
    );

    // ✅ STEP 1: Run KYC Workflow V2
    console.log("🔄 Starting KYC Workflow V2...");

    // filePaths is now: { "frontAadhar": "path/to/img.jpg", ... }
    workflowResult = await processKycDocumentsV3(filePaths, {
      maxRetries: 2,
      enableImprovements: true,
    });

    if (!workflowResult || !workflowResult.extractedData) {
      throw new Error("Workflow failed to extract data");
    }

    console.log("✅ Workflow completed successfully");

    const {
      extractedData,
      validationResult,
      verificationResult,
      improvementRecommendations,
    } = workflowResult;

    // ❌ STEP 1.5: Handle Verification Failure
    if (!verificationResult.verified) {
      await cleanupFiles(filePaths);
      await recordKycFailure(
        req.user._id,
        extractedData,
        validationResult,
        verificationResult,
        new Error("KYC verification failed")
      );

      return res.status(422).json({
        success: false,
        error: "KYC verification failed",
        reason: verificationResult.reason,
        confidence: verificationResult.confidence,
        verificationLevel: verificationResult.verificationLevel,
        validationIssues: validationResult.criticalIssues,
        warnings: validationResult.warnings,
        improvementRecommendations: improvementRecommendations || null,
        // Only show extracted data in dev mode for debugging
        extracted: config.env === "development" ? extractedData : undefined,
      });
    }

    // ✅ STEP 2: Encrypt & Upload to Cloudinary (Parallel)
    console.log("🔄 Uploading encrypted images to Cloudinary...");
    const urls = {};

    const uploadPromises = Object.entries(filePaths).map(async ([key, fp]) => {
      if (!fp) return;
      try {
        const encryptedBuffer = await compressAndEncryptImage(fp);
        urls[key] = await uploadImageToCloudinary(
          encryptedBuffer,
          `kyc/${req.user.id}/${key}-${Date.now()}`
        );
        await deleteLocalFile(fp);
        console.log(`✅ Uploaded ${key}`);
      } catch (uploadError) {
        console.error(`❌ Upload failed for ${key}:`, uploadError.message);
        throw uploadError;
      }
    });

    await Promise.all(uploadPromises);

    // ✅ STEP 3: Save to Database with Enhanced Metadata
    console.log("💾 Saving enhanced KYC data to database...");

    const existingStudent = await Student.findById(req.user._id).select(
      "kycData kycStatus"
    );

    // Reset old data if exists
    if (
      existingStudent &&
      existingStudent.kycData &&
      Object.keys(existingStudent.kycData).length > 0
    ) {
      console.log("⚠️ Existing KYC data found. Resetting...");
      existingStudent.kycStatus = "pending";
      existingStudent.kycVerifiedAt = null;
      existingStudent.kycData = {};
      await existingStudent.save();
    }

    const updateData = {
      // Image URLs
      "kycData.aadhaarFrontUrl": urls.frontAadhar,
      "kycData.aadhaarBackUrl": urls.backAadhar,
      "kycData.panCardUrl": urls.frontPan,
      ...(urls.backPan && { "kycData.panCardBackUrl": urls.backPan }),
      "kycData.passportUrl": urls.passportPhoto,

      // 🔐 Encrypted Sensitive Data
      "kycData.aadhaarNumber": encryptText(extractedData.aadhaarNumber),
      "kycData.panNumber": encryptText(extractedData.panNumber),
      "kycData.passportNumber": encryptText(extractedData.passportNumber),

      // 📝 Plain Text Data
      "kycData.aadhaarName": extractedData.aadhaarName,
      "kycData.aadhaarDOB": parseDate(extractedData.aadhaarDOB),
      "kycData.aadhaarAddress": extractedData.aadhaarAddress,
      "kycData.aadhaarGender": extractedData.aadhaarGender,
      "kycData.panName": extractedData.panName,
      "kycData.panDOB": parseDate(extractedData.panDOB),
      "kycData.panFatherName": extractedData.panFatherName,
      "kycData.passportName": extractedData.passportName,
      "kycData.passportDOB": parseDate(extractedData.passportDOB),
      "kycData.passportIssueDate": parseDate(extractedData.passportIssueDate),
      "kycData.passportExpiryDate": parseDate(extractedData.passportExpiryDate),
      "kycData.passportPlaceOfIssue": extractedData.passportPlaceOfIssue,
      "kycData.passportPlaceOfBirth": extractedData.passportPlaceOfBirth,

      // ✅ Enhanced Verification Metadata (V2)
      "kycData.lastVerifiedAt": new Date(),
      "kycData.verificationSource": "ai_workflow_v2",
      "kycData.verificationConfidence": verificationResult.confidence,
      "kycData.verificationLevel": verificationResult.verificationLevel,
      "kycData.verificationReason": verificationResult.reason,
      "kycData.documentCompleteness": validationResult.completeness,
      "kycData.identityConfirmation": verificationResult.identityConfirmation,
      "kycData.complianceChecks": verificationResult.complianceChecks,
      "kycData.riskAssessment": verificationResult.riskAssessment,
      "kycData.validationIssues": validationResult.criticalIssues || [],
      "kycData.verificationIssues":
        verificationResult.identityConfirmation?.inconsistencies || [],

      // Status Update
      kycStatus: "verified",
      kycVerifiedAt: new Date(),
      kycRejectedAt: null,
      "kycData.failureCount": 0,
    };

    const student = await Student.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // ✅ STEP 4: Success Response
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.status(200).json({
      success: true,
      message: "KYC Verified Successfully",
      status: student.kycStatus,
      processingTime: `${duration}s`,
      verificationLevel: verificationResult.verificationLevel,
      confidence: verificationResult.confidence,
      extracted: config.env === "development" ? extractedData : undefined,
    });
  } catch (error) {
    console.error("❌ V2 Controller Error:", error.message);

    // Cleanup files on error
    await cleanupFiles(filePaths);

    // If workflow result exists, record failure properly
    if (workflowResult) {
      await recordKycFailure(
        req.user._id,
        workflowResult.extractedData,
        workflowResult.validationResult,
        workflowResult.verificationResult,
        error
      );
    } else {
      // If error happened before workflow finished
      await recordKycFailure(req.user._id, null, null, null, error);
    }

    return next(
      new AppError(
        error.message || "KYC Processing Failed",
        error.statusCode || 500
      )
    );
  }
});

// ============================================================================
// 🔍 GET KYC STATUS V2 (Optimized)
// ============================================================================
exports.getKYCDetailsV2 = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.user.id)
    .select(
      "kycStatus kycVerifiedAt kycData.verificationLevel kycData.failureCount kycData.validationIssues kycData.verificationReason"
    )
    .lean();

  if (!student) return next(new AppError("Student not found", 404));

  res.status(200).json({
    success: true,
    status: student.kycStatus,
    verifiedAt: student.kycVerifiedAt,
    level: student.kycData?.verificationLevel,
    reason: student.kycData?.verificationReason,
    issues: student.kycData?.validationIssues || [],
  });
});

// ============================================================================
// 🗑️ DELETE KYC V2
// ============================================================================
exports.deleteKYCV2 = asyncHandler(async (req, res, next) => {
  const student = await Student.findById(req.user.id);
  if (!student) return next(new AppError("Student not found", 404));

  student.kycStatus = "pending";
  student.kycVerifiedAt = null;
  student.kycData = {};
  await student.save();

  res.status(200).json({
    success: true,
    message: "KYC data deleted successfully",
  });
});
