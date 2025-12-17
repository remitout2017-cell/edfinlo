// controllers/kycdetailsuplodev2.js - ENHANCED CONTROLLER FOR KYC V2
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
const cache = require("../utils/cache");

// 🔧 DATE PARSER
function parseDate(dateStr) {
  if (!dateStr) return undefined;
  const parts = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (parts) {
    const [, day, month, year] = parts;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? undefined : date;
  }
  const isoDate = new Date(dateStr);
  return isNaN(isoDate.getTime()) ? undefined : isoDate;
}

// 🔐 ENCRYPT TEXT
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

// 🧹 CLEANUP FILES
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

// 📊 RECORD KYC FAILURE
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

// 🚀 MAIN CONTROLLER V2 - Enhanced upload and verification
exports.uploadDocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = {};
  let workflowResult = null;

  try {
    // ✅ STEP 0: Input validation
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("No documents uploaded", 400);
    }

    // Extract file paths
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

    // ✅ STEP 1: Run KYC Workflow V2 (Extraction + Validation + Verification + Improvements)
    console.log("🔄 Starting KYC Workflow V2...");
    try {
      workflowResult = await processKycDocumentsV3(filePaths, {
        maxRetries: 2,
        enableImprovements: true,
      });

      if (!workflowResult || !workflowResult.extractedData) {
        throw new Error("Workflow failed to extract data");
      }

      console.log("✅ Workflow completed successfully");
    } catch (workflowError) {
      console.error("❌ Workflow failed:", workflowError.message);
      await cleanupFiles(filePaths);
      await recordKycFailure(req.user._id, null, null, null, workflowError);
      throw new AppError(
        `KYC processing failed: ${workflowError.message}`,
        422
      );
    }

    const {
      extractedData,
      validationResult,
      verificationResult,
      improvementRecommendations,
    } = workflowResult;

    // ❌ STEP 1.5: Handle verification failure
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
        extracted: config.env === "development" ? extractedData : undefined,
      });
    }

    // ✅ STEP 2: Encrypt & Upload to Cloudinary (parallel)
    console.log("🔄 Uploading encrypted images to Cloudinary...");
    const urls = {};
    try {
      const uploadPromises = Object.entries(filePaths).map(
        async ([key, fp]) => {
          if (!fp) return;
          try {
            const encryptedBuffer = await compressAndEncryptImage(fp);
            urls[key] = await uploadImageToCloudinary(
              encryptedBuffer,
              `kyc/${key}-${Date.now()}`
            );
            await deleteLocalFile(fp);
            console.log(`✅ Uploaded ${key}`);
          } catch (uploadError) {
            console.error(`❌ Upload failed for ${key}:`, uploadError.message);
            throw uploadError;
          }
        }
      );
      await Promise.all(uploadPromises);
    } catch (uploadError) {
      await cleanupFiles(filePaths);
      await recordKycFailure(
        req.user._id,
        extractedData,
        validationResult,
        verificationResult,
        uploadError
      );
      throw new AppError(`Image upload failed: ${uploadError.message}`, 500);
    }

    // ✅ STEP 3: Save to Database with enhanced metadata
    console.log("💾 Saving enhanced KYC data to database...");
    try {
      // Check for existing KYC data
      const existingStudent = await Student.findById(req.user._id).select(
        "kycData kycStatus"
      );

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
        console.log("✅ Old KYC data deleted");
      }

      const updateData = {
        // Image URLs
        "kycData.aadhaarFrontUrl": urls.frontAadhar,
        "kycData.aadhaarBackUrl": urls.backAadhar,
        "kycData.panCardUrl": urls.frontPan,
        ...(urls.backPan && { "kycData.panCardBackUrl": urls.backPan }),
        "kycData.passportUrl": urls.passportPhoto,

        // 🔐 Encrypted sensitive data
        "kycData.aadhaarNumber": encryptText(extractedData.aadhaarNumber),
        "kycData.panNumber": encryptText(extractedData.panNumber),
        "kycData.passportNumber": encryptText(extractedData.passportNumber),

        // 📝 Plain text data
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
        "kycData.passportExpiryDate": parseDate(
          extractedData.passportExpiryDate
        ),
        "kycData.passportPlaceOfIssue": extractedData.passportPlaceOfIssue,
        "kycData.passportPlaceOfBirth": extractedData.passportPlaceOfBirth,

        // ✅ Enhanced verification metadata (V2)
        "kycData.lastVerifiedAt": new Date(),
        "kycData.verificationSource": "ai_workflow_v2",
        "kycData.verificationConfidence": verificationResult.confidence,
        "kycData.verificationLevel": verificationResult.verificationLevel,
        "kycData.verificationReason":
          verificationResult.reason || "AI verified successfully",
        "kycData.validationScore": validationResult.overallConfidence,
        "kycData.extractionMetadata": extractedData.extractionMetadata,
        "kycData.documentCompleteness": verificationResult.documentCompleteness,
        "kycData.identityConfirmation": verificationResult.identityConfirmation,
        "kycData.complianceChecks": verificationResult.complianceChecks,
        "kycData.riskAssessment": verificationResult.riskAssessment,
        "kycData.failureCount": 0,
        "kycData.failedAt": null,

        // 🎯 Status update
        kycStatus: "verified",
        kycVerifiedAt: new Date(),
        kycVerificationMethod: "ai_workflow_v2",
      };

      const updatedStudent = await Student.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedStudent) {
        throw new Error("Failed to update student record");
      }

      const duration = Date.now() - startTime;
      console.log(`✅ KYC V2 pipeline completed successfully in ${duration}ms`);

      res.json({
        success: true,
        message: "KYC verified and stored successfully (V2 Enhanced)",
        data: {
          kycStatus: updatedStudent.kycStatus,
          kycVerifiedAt: updatedStudent.kycVerifiedAt,
          verificationConfidence: verificationResult.confidence,
          verificationLevel: verificationResult.verificationLevel,
          validationScore: validationResult.overallConfidence,
          documentCompleteness: verificationResult.documentCompleteness,
          riskAssessment: verificationResult.riskAssessment,
          processingTime: `${duration}ms`,
          metadata: workflowResult.metadata,
          urls: config.env === "development" ? urls : undefined,
          extracted: config.env === "development" ? extractedData : undefined,
        },
      });
    } catch (dbError) {
      console.error("❌ Database save failed:", dbError.message);
      throw new AppError(`Failed to save KYC data: ${dbError.message}`, 500);
    }
  } catch (error) {
    console.error("❌ KYC V2 pipeline error:", error.message);
    await cleanupFiles(filePaths);
    next(error);
  }
});

// 📥 GET KYC details (enhanced with V2 metadata)
exports.getKYCDetailsV2 = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `kyc:v2:${userId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "KYC details fetched successfully (V2, cached)",
        kyc: cached,
        fromCache: true,
      });
    }

    const student = await Student.findById(userId)
      .select("kycStatus kycVerifiedAt kycData firstName lastName")
      .lean();

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    const kycData = {
      kycStatus: student.kycStatus,
      kycVerifiedAt: student.kycVerifiedAt,
      kycData: {
        aadhaarFrontUrl: student.kycData?.aadhaarFrontUrl,
        aadhaarBackUrl: student.kycData?.aadhaarBackUrl,
        panCardUrl: student.kycData?.panCardUrl,
        passportUrl: student.kycData?.passportUrl,
        aadhaarName: student.kycData?.aadhaarName,
        panName: student.kycData?.panName,
        passportName: student.kycData?.passportName,
        aadhaarDOB: student.kycData?.aadhaarDOB,
        panDOB: student.kycData?.panDOB,
        passportDOB: student.kycData?.passportDOB,
        verificationConfidence: student.kycData?.verificationConfidence,
        verificationLevel: student.kycData?.verificationLevel,
        validationScore: student.kycData?.validationScore,
        lastVerifiedAt: student.kycData?.lastVerifiedAt,
        verificationReason: student.kycData?.verificationReason,
        documentCompleteness: student.kycData?.documentCompleteness,
        riskAssessment: student.kycData?.riskAssessment,
        extractionMetadata: student.kycData?.extractionMetadata,
      },
    };

    cache.set(cacheKey, kycData, 120);

    res.status(200).json({
      success: true,
      message: "KYC details fetched successfully (V2)",
      kyc: kycData,
      fromCache: false,
    });
  } catch (error) {
    console.error("❌ Get KYC V2 error:", error.message);
    next(error);
  }
});

// 🗑️ DELETE KYC (same as V1)
exports.deleteKYCV2 = asyncHandler(async (req, res, next) => {
  try {
    const student = await Student.findById(req.user._id);
    if (!student) {
      throw new AppError("Student not found", 404);
    }

    student.kycStatus = "pending";
    student.kycVerifiedAt = null;
    student.kycData = {};
    await student.save();

    res.status(200).json({
      success: true,
      message: "KYC details deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete KYC V2 error:", error.message);
    next(error);
  }
});
