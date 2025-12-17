// controllers/academicRecordsControllerV2.js - ENHANCED CONTROLLER FOR ACADEMIC RECORDS V2
const AcademicRecords = require("../models/AcademicRecords");
const { processAcademicDocumentsV2 } = require("../agents/academicRecordsAgenticWorkflowV2");
const {
  compressImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const cache = require('../utils/cache'); // <-- add this

// 🧹 CLEANUP FILES
async function cleanupFiles(filePaths) {
  if (!filePaths || !Array.isArray(filePaths)) return;
  const cleanupPromises = filePaths
    .filter((fp) => fp && typeof fp === "string")
    .map((fp) =>
      deleteLocalFile(fp).catch((err) =>
        console.warn(`⚠️ Failed to cleanup ${fp}:`, err.message)
      )
    );
  await Promise.allSettled(cleanupPromises);
}

// Convert confidence string to number
function getConfidenceScore(confidence) {
  if (typeof confidence === "number") return confidence / 100;
  const map = { high: 0.9, medium: 0.7, low: 0.5 };
  return map[confidence] || 0.5;
}

// 📊 RECORD ACADEMIC FAILURE
async function recordAcademicFailure(userId, educationType, extracted, validation, verification, error) {
  try {
    const academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) return;

    const failureNote = `Failed ${educationType} upload: ${verification?.reason || validation?.criticalIssues?.join(", ") || error.message
      }`;

    academicRecord.overallVerificationStatus = "manual_review";
    academicRecord.lastVerifiedAt = new Date();

    await academicRecord.save();
    console.log(`📝 Recorded ${educationType} failure for user ${userId}`);
  } catch (dbError) {
    console.error("❌ Failed to record academic failure:", dbError.message);
  }
}

// 🚀 UPLOAD CLASS 10 DOCUMENTS V2
exports.uploadClass10DocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePath = null;
  let workflowResult = null;

  try {
    const userId = req.user._id;
    const file = req.file;

    if (!file) {
      throw new AppError("Class 10 marksheet is required", 400);
    }

    filePath = file.path;
    console.log(`📄 Processing Class 10 document for user ${userId}`);

    // ✅ STEP 1: Run Academic Workflow V2
    console.log("🔄 Starting Class 10 Workflow V2...");
    try {
      workflowResult = await processAcademicDocumentsV2([filePath], "class10", {
        maxRetries: 2,
        enableImprovements: true,
      });

      if (!workflowResult || !workflowResult.extractedData) {
        throw new Error("Workflow failed to extract data");
      }

      console.log("✅ Workflow completed successfully");
    } catch (workflowError) {
      console.error("❌ Workflow failed:", workflowError.message);
      await cleanupFiles([filePath]);
      await recordAcademicFailure(userId, "class10", null, null, null, workflowError);
      throw new AppError(
        `Class 10 processing failed: ${workflowError.message}`,
        422
      );
    }

    const { extractedData, validationResult, verificationResult, improvementRecommendations } = workflowResult;

    // ❌ STEP 1.5: Handle verification failure
    if (!verificationResult.verified) {
      await cleanupFiles([filePath]);
      await recordAcademicFailure(
        userId,
        "class10",
        extractedData,
        validationResult,
        verificationResult,
        new Error("Class 10 verification failed")
      );

      return res.status(422).json({
        success: false,
        error: "Class 10 verification failed",
        reason: verificationResult.reason,
        confidence: verificationResult.confidence,
        verificationLevel: verificationResult.verificationLevel,
        validationIssues: validationResult.criticalIssues,
        warnings: validationResult.warnings,
        improvementRecommendations: improvementRecommendations || null,
        extracted: extractedData,
      });
    }

    // ✅ STEP 2: Upload to Cloudinary
    console.log("🔄 Uploading to Cloudinary...");
    let documentUrl;
    try {
      const compressedBuffer = await compressImage(filePath);
      documentUrl = await uploadImageToCloudinary(
        compressedBuffer,
        `academic/class10/${userId}-${Date.now()}`
      );
      await deleteLocalFile(filePath);
      console.log(`✅ Uploaded Class 10 document to Cloudinary`);
    } catch (uploadError) {
      await cleanupFiles([filePath]);
      await recordAcademicFailure(userId, "class10", extractedData, validationResult, verificationResult, uploadError);
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    // ✅ STEP 3: Save to Database with V2 metadata
    console.log("💾 Saving enhanced Class 10 data to database...");
    try {
      const marksheet = {
        documentUrl,
        institutionName: extractedData.institutionName || null,
        boardUniversity: extractedData.boardUniversity || null,
        yearOfPassing: extractedData.yearOfPassing || null,
        percentage: extractedData.percentage || null,
        cgpa: extractedData.cgpa || null,
        grade: extractedData.grade || null,
        extractionStatus: verificationResult.verified ? "success" : "manual_review",
        extractionConfidence: getConfidenceScore(verificationResult.confidence),
        extractedAt: new Date(),
        extractedData: extractedData,
        verificationReason: verificationResult.reason,
        // V2 Enhanced metadata
        verificationLevel: verificationResult.verificationLevel,
        dataCompleteness: verificationResult.dataCompleteness,
        qualityAssessment: verificationResult.qualityAssessment,
        extractionMetadata: extractedData.extractionMetadata,
      };

      let academicRecord = await AcademicRecords.findOne({ user: userId });
      if (!academicRecord) {
        academicRecord = new AcademicRecords({ user: userId });
      }

      // Replace existing Class 10 data
      if (academicRecord.class10 && academicRecord.class10.marksheets?.length > 0) {
        console.log("⚠️ Existing Class 10 data found. Replacing...");
        academicRecord.class10 = undefined;
      }

      academicRecord.class10 = {
        marksheets: [marksheet],
        isVerified: verificationResult.verified && verificationResult.verificationLevel === "high",
        verificationNotes: verificationResult.reason,
        lastUpdated: new Date(),
      };

      academicRecord.updateVerificationStatus();
      await academicRecord.save();

      const duration = Date.now() - startTime;
      console.log(`✅ Class 10 V2 pipeline completed in ${duration}ms`);

      return res.status(200).json({
        success: true,
        message: "Class 10 marksheet uploaded successfully (V2 Enhanced)",
        data: {
          documentType: "class10",
          extractedData,
          validationResult,
          verificationResult,
          improvementRecommendations,
          class10: academicRecord.class10,
          processingTime: `${duration}ms`,
          metadata: workflowResult.metadata,
        },
      });
    } catch (dbError) {
      console.error("❌ Database save failed:", dbError.message);
      throw new AppError(`Failed to save Class 10 data: ${dbError.message}`, 500);
    }
  } catch (error) {
    console.error("❌ Class 10 V2 upload error:", error.message);
    await cleanupFiles(filePath ? [filePath] : []);
    next(error);
  }
});

// 🚀 UPLOAD CLASS 12 DOCUMENTS V2
exports.uploadClass12DocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePath = null;
  let workflowResult = null;

  try {
    const userId = req.user._id;
    const { stream } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError("Class 12 marksheet is required", 400);
    }

    filePath = file.path;
    console.log(`📄 Processing Class 12 document for user ${userId}`);

    // ✅ STEP 1: Run Workflow V2
    console.log("🔄 Starting Class 12 Workflow V2...");
    try {
      workflowResult = await processAcademicDocumentsV2([filePath], "class12", {
        maxRetries: 2,
        enableImprovements: true,
      });

      if (!workflowResult || !workflowResult.extractedData) {
        throw new Error("Workflow failed to extract data");
      }
    } catch (workflowError) {
      await cleanupFiles([filePath]);
      await recordAcademicFailure(userId, "class12", null, null, null, workflowError);
      throw new AppError(`Class 12 processing failed: ${workflowError.message}`, 422);
    }

    const { extractedData, validationResult, verificationResult, improvementRecommendations } = workflowResult;

    // ❌ Handle verification failure
    if (!verificationResult.verified) {
      await cleanupFiles([filePath]);
      await recordAcademicFailure(userId, "class12", extractedData, validationResult, verificationResult, new Error("Verification failed"));

      return res.status(422).json({
        success: false,
        error: "Class 12 verification failed",
        reason: verificationResult.reason,
        confidence: verificationResult.confidence,
        verificationLevel: verificationResult.verificationLevel,
        validationIssues: validationResult.criticalIssues,
        warnings: validationResult.warnings,
        improvementRecommendations: improvementRecommendations || null,
        extracted: extractedData,
      });
    }

    // ✅ Upload to Cloudinary
    let documentUrl;
    try {
      const compressedBuffer = await compressImage(filePath);
      documentUrl = await uploadImageToCloudinary(
        compressedBuffer,
        `academic/class12/${userId}-${Date.now()}`
      );
      await deleteLocalFile(filePath);
    } catch (uploadError) {
      await cleanupFiles([filePath]);
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    // ✅ Save to Database
    const marksheet = {
      documentUrl,
      institutionName: extractedData.institutionName || null,
      boardUniversity: extractedData.boardUniversity || null,
      yearOfPassing: extractedData.yearOfPassing || null,
      percentage: extractedData.percentage || null,
      cgpa: extractedData.cgpa || null,
      grade: extractedData.grade || null,
      extractionStatus: verificationResult.verified ? "success" : "manual_review",
      extractionConfidence: getConfidenceScore(verificationResult.confidence),
      extractedAt: new Date(),
      extractedData: extractedData,
      verificationReason: verificationResult.reason,
      verificationLevel: verificationResult.verificationLevel,
      dataCompleteness: verificationResult.dataCompleteness,
      qualityAssessment: verificationResult.qualityAssessment,
      extractionMetadata: extractedData.extractionMetadata,
    };

    let academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) {
      academicRecord = new AcademicRecords({ user: userId });
    }

    if (academicRecord.class12 && academicRecord.class12.marksheets?.length > 0) {
      console.log("⚠️ Existing Class 12 data found. Replacing...");
      academicRecord.class12 = undefined;
    }

    academicRecord.class12 = {
      marksheets: [marksheet],
      stream: stream || extractedData.stream || null,
      isVerified: verificationResult.verified && verificationResult.verificationLevel === "high",
      verificationNotes: verificationResult.reason,
      lastUpdated: new Date(),
    };

    academicRecord.updateVerificationStatus();
    await academicRecord.save();

    const duration = Date.now() - startTime;
    console.log(`✅ Class 12 V2 pipeline completed in ${duration}ms`);

    return res.status(200).json({
      success: true,
      message: "Class 12 marksheet uploaded successfully (V2 Enhanced)",
      data: {
        documentType: "class12",
        extractedData,
        validationResult,
        verificationResult,
        improvementRecommendations,
        class12: academicRecord.class12,
        processingTime: `${duration}ms`,
        metadata: workflowResult.metadata,
      },
    });
  } catch (error) {
    console.error("❌ Class 12 V2 upload error:", error.message);
    await cleanupFiles(filePath ? [filePath] : []);
    next(error);
  }
});

// 🚀 UPLOAD HIGHER EDUCATION DOCUMENTS V2
exports.uploadGraduationDocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = [];
  let workflowResult = null;

  try {
    const userId = req.user._id;
    const { educationType, courseName, specialization, duration } = req.body;
    const files = req.files;

    // Validation
    const validTypes = [
      "diploma", "associate", "bachelor", "bachelors", "postgraduate_diploma",
      "master", "masters", "phd", "doctorate", "certificate", "professional", "vocational", "other",
    ];

    if (!educationType || !validTypes.includes(educationType)) {
      throw new AppError(`Invalid education type. Must be one of: ${validTypes.join(", ")}`, 400);
    }

    if (!courseName || courseName.trim().length === 0) {
      throw new AppError("Course name is required", 400);
    }

    if (!files || files.length === 0) {
      throw new AppError("At least one marksheet is required", 400);
    }

    if (files.length > 10) {
      throw new AppError("Maximum 10 marksheets allowed", 400);
    }

    filePaths = files.map((f) => f.path);
    console.log(`📄 Processing ${files.length} ${educationType} document(s) for user ${userId}`);

    // ✅ STEP 1: Run Workflow V2
    console.log(`🔄 Starting ${educationType} Workflow V2...`);
    try {
      workflowResult = await processAcademicDocumentsV2(filePaths, educationType, {
        maxRetries: 2,
        enableImprovements: true,
      });

      if (!workflowResult || !workflowResult.extractedData) {
        throw new Error("Workflow failed to extract data");
      }
    } catch (workflowError) {
      await cleanupFiles(filePaths);
      await recordAcademicFailure(userId, educationType, null, null, null, workflowError);
      throw new AppError(`${educationType} processing failed: ${workflowError.message}`, 422);
    }

    const { extractedData, validationResult, verificationResult, improvementRecommendations } = workflowResult;

    // ❌ Handle verification failure
    if (!verificationResult.verified) {
      await cleanupFiles(filePaths);
      await recordAcademicFailure(userId, educationType, extractedData, validationResult, verificationResult, new Error("Verification failed"));

      return res.status(422).json({
        success: false,
        error: `${educationType} verification failed`,
        reason: verificationResult.reason,
        confidence: verificationResult.confidence,
        verificationLevel: verificationResult.verificationLevel,
        validationIssues: validationResult.criticalIssues,
        warnings: validationResult.warnings,
        improvementRecommendations: improvementRecommendations || null,
        extracted: extractedData,
      });
    }

    // ✅ Upload to Cloudinary (parallel)
    let documentUrls = [];
    try {
      const uploadPromises = files.map(async (file, index) => {
        const compressedBuffer = await compressImage(file.path);
        const url = await uploadImageToCloudinary(
          compressedBuffer,
          `academic/${educationType}/${userId}-${Date.now()}-${index}`
        );
        await deleteLocalFile(file.path);
        return url;
      });
      documentUrls = await Promise.all(uploadPromises);
      console.log(`✅ Uploaded ${documentUrls.length} documents to Cloudinary`);
    } catch (uploadError) {
      await cleanupFiles(filePaths);
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    // ✅ Save to Database
    const marksheets = documentUrls.map((url) => ({
      documentUrl: url,
      institutionName: extractedData.institutionName || null,
      boardUniversity: extractedData.boardUniversity || null,
      yearOfPassing: extractedData.yearOfPassing || null,
      percentage: extractedData.percentage || null,
      cgpa: extractedData.cgpa || null,
      grade: extractedData.grade || null,
      extractionStatus: verificationResult.verified ? "success" : "manual_review",
      extractionConfidence: getConfidenceScore(verificationResult.confidence),
      extractedAt: new Date(),
      extractedData: extractedData,
      verificationReason: verificationResult.reason,
      verificationLevel: verificationResult.verificationLevel,
      dataCompleteness: verificationResult.dataCompleteness,
      qualityAssessment: verificationResult.qualityAssessment,
      extractionMetadata: extractedData.extractionMetadata,
    }));

    let academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) {
      academicRecord = new AcademicRecords({ user: userId });
    }

    // Replace existing education of same type
    const existingIndex = academicRecord.higherEducation.findIndex(
      edu => edu.educationType === educationType &&
        edu.courseName?.toLowerCase() === courseName.trim().toLowerCase()
    );

    if (existingIndex !== -1) {
      console.log(`⚠️ Existing ${educationType} (${courseName}) found. Replacing...`);
      academicRecord.higherEducation.splice(existingIndex, 1);
    }

    const newEducation = {
      educationType,
      courseName: courseName.trim(),
      specialization: specialization?.trim() || null,
      duration: duration?.trim() || null,
      marksheets,
      isVerified: verificationResult.verified && verificationResult.verificationLevel === "high",
      verificationNotes: verificationResult.reason,
    };

    academicRecord.higherEducation.push(newEducation);
    academicRecord.updateVerificationStatus();
    await academicRecord.save();

    const processingDuration = Date.now() - startTime;
    console.log(`✅ ${educationType} V2 pipeline completed in ${processingDuration}ms`);

    return res.status(200).json({
      success: true,
      message: `${educationType} documents uploaded successfully (V2 Enhanced)`,
      data: {
        documentType: educationType,
        extractedData,
        validationResult,
        verificationResult,
        improvementRecommendations,
        higherEducation: academicRecord.higherEducation[academicRecord.higherEducation.length - 1],
        processingTime: `${processingDuration}ms`,
        metadata: workflowResult.metadata,
      },
    });
  } catch (error) {
    console.error(`❌ Higher education V2 upload error:`, error.message);
    await cleanupFiles(filePaths);
    next(error);
  }
});

// 📥 GET ACADEMIC RECORDS (Enhanced with V2 metadata)
exports.getAcademicRecordsV2 = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const academicRecord = await AcademicRecords.findOne({ user: userId })
      .populate("user", "firstName lastName email")
      .lean();
    const cacheKey = `academic:v2:summary:${userId}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Academic records fetched successfully (V2, cached)",
        academicRecord: cached,
        fromCache: true,
      });
    }

    if (!academicRecord) {
      throw new AppError("No academic records found", 404);
    }

    await cache.set(cacheKey, academicRecord, 120);

    return res.status(200).json({
      success: true,
      message: "Academic records fetched successfully (V2)",
      data: academicRecord,
    });
  } catch (error) {
    console.error("❌ Get academic records V2 error:", error.message);
    next(error);
  }
});

// 🗑️ DELETE HIGHER EDUCATION (Same as V1)
exports.deleteHigherEducationV2 = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { educationId } = req.params;

    const academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) {
      throw new AppError("No academic records found", 404);
    }

    await academicRecord.removeHigherEducation(educationId);
    academicRecord.updateVerificationStatus();
    await academicRecord.save();

    return res.status(200).json({
      success: true,
      message: "Higher education record deleted successfully",
      data: academicRecord,
    });
  } catch (error) {
    console.error("❌ Delete higher education V2 error:", error.message);
    next(error);
  }
});
