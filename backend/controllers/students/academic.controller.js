// controllers/students/academic.controller.js - COMPLETE WITH FIX

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const AcademicRecords = require("../../models/student/AcademicRecords");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

const AGENT_SERVER_URL =
  process.env.AGENT_SERVER_URL || "http://localhost:8000";

// ========== HELPERS ==========

async function uploadAcademicDocument(filePath, userId, docType) {
  console.log(`\n📤 [UPLOAD START] ${docType}`);
  console.log(` File path: ${filePath}`);
  console.log(` File exists: ${fs.existsSync(filePath)}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const publicId = `${docType}_${Date.now()}`;
  console.log(` Cloudinary public_id: ${publicId}`);
  console.log(` Calling uploadToCloudinary...`);

  try {
    const result = await uploadToCloudinary(filePath, {
      folder: `students/${userId}/academic`,
      resource_type: "raw",
      type: "upload",
      public_id: publicId,
    });

    console.log(` Raw Cloudinary result:`, JSON.stringify(result, null, 2));

    if (!result) {
      throw new Error("uploadToCloudinary returned null/undefined");
    }

    const uploadResult = {
      url: result.secure_url || result.url,
      publicId: result.public_id || publicId,
      resourceType: result.resource_type || "raw",
      type: "upload",
    };

    console.log(` Mapped result:`, JSON.stringify(uploadResult, null, 2));

    if (!uploadResult.url) {
      console.error(` ❌ ERROR: No URL in result!`);
      throw new Error(
        `Cloudinary upload failed for ${docType} - no URL returned`
      );
    }

    console.log(`✅ [UPLOAD SUCCESS] ${docType}: ${uploadResult.url}`);
    return uploadResult;
  } catch (error) {
    console.error(`❌ [UPLOAD FAILED] ${docType}:`, error);
    throw new Error(
      `Cloudinary upload failed for ${docType}: ${error.message}`
    );
  }
}

async function deleteAcademicDocument(publicId, resourceType = "raw") {
  if (!publicId) return;
  try {
    await deleteFromCloudinary({
      publicId,
      resourceType,
      type: "upload",
    });
    console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error(`⚠️ Failed to delete from Cloudinary: ${publicId}`, error);
  }
}

async function callAgentServer(endpoint, files) {
  const form = new FormData();

  if (files.pdf_10th?.[0]) {
    console.log("📤 Adding pdf_10th to form data");
    form.append("pdf_10th", fs.createReadStream(files.pdf_10th[0].path));
  }

  if (files.pdf_12th?.[0]) {
    console.log("📤 Adding pdf_12th to form data");
    form.append("pdf_12th", fs.createReadStream(files.pdf_12th[0].path));
  }

  if (files.pdf_graduation?.[0]) {
    console.log("📤 Adding pdf_graduation to form data");
    form.append(
      "pdf_graduation",
      fs.createReadStream(files.pdf_graduation[0].path)
    );
  }

  try {
    console.log(`🔄 Calling Python agent: ${AGENT_SERVER_URL}${endpoint}`);
    const response = await axios.post(`${AGENT_SERVER_URL}${endpoint}`, form, {
      headers: { ...form.getHeaders() },
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log("✅ Agent server response received");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Agent server error:",
      error.response?.data || error.message
    );
    throw new AppError(
      `Agent extraction failed: ${
        error.response?.data?.detail || error.message
      }`,
      500
    );
  }
}

function cleanupTempFiles(files) {
  const allFiles = [
    ...(files.pdf_10th || []),
    ...(files.pdf_12th || []),
    ...(files.pdf_graduation || []),
  ];

  allFiles.forEach((file) => {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Cleaned up temp file: ${file.path}`);
      }
    } catch (err) {
      console.error("⚠️ Error deleting temp file:", err);
    }
  });
}

function mapClass10FromAgent(d, uploadResult) {
  if (!d) {
    throw new Error("Class 10 extraction data is null/undefined");
  }

  if (!uploadResult || !uploadResult.url) {
    console.error("❌ Upload result missing:", uploadResult);
    throw new Error("Class 10 document upload failed - no URL returned");
  }

  console.log(`✅ Mapping Class 10 with URL: ${uploadResult.url}`);
  return {
    boardName: d.board_name,
    boardType: d.board_type,
    yearOfPassing: d.year_of_passing,
    rollNumber: d.roll_number,
    schoolName: d.school_name,
    percentage: d.percentage,
    cgpa: d.cgpa,
    cgpaScale: d.cgpa_scale,
    grade: d.grade,
    division: d.division,
    universalGrade: d.universal_grade,
    normalizedPercentage: d.normalized_percentage,
    conversionInfo: d.conversion_info
      ? {
          method: d.conversion_info.conversion_method,
          original: d.conversion_info.original_grade,
        }
      : undefined,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: 0.95,
    extractedAt: new Date(),
    extractedData: d,
  };
}

function mapClass12FromAgent(d, uploadResult) {
  if (!d) {
    throw new Error("Class 12 extraction data is null/undefined");
  }

  if (!uploadResult || !uploadResult.url) {
    console.error("❌ Upload result missing:", uploadResult);
    throw new Error("Class 12 document upload failed - no URL returned");
  }

  console.log(`✅ Mapping Class 12 with URL: ${uploadResult.url}`);
  return {
    boardName: d.board_name,
    yearOfPassing: d.year_of_passing,
    stream: d.stream,
    schoolName: d.school_name,
    percentage: d.percentage,
    cgpa: d.cgpa,
    grade: d.grade,
    convertedGrade: d.converted_grade,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: 0.95,
    extractedAt: new Date(),
    extractedData: d,
  };
}

function mapGraduationFromAgent(d, uploadResult) {
  if (!d) {
    throw new Error("Graduation extraction data is null/undefined");
  }

  if (!uploadResult || !uploadResult.url) {
    console.error("❌ Upload result missing:", uploadResult);
    throw new Error("Graduation document upload failed - no URL returned");
  }

  console.log(`✅ Mapping Graduation with URL: ${uploadResult.url}`);
  return {
    institutionName: d.institution_name,
    degree: d.degree,
    specialization: d.specialization,
    yearOfPassing: d.year_of_passing,
    durationYears: d.duration_years,
    semesters: (d.semesters || []).map((sem) => ({
      semesterYear: sem.semester_year,
      yearOfCompletion: sem.year_of_completion,
      percentage: sem.percentage,
      cgpa: sem.cgpa,
      grade: sem.grade,
    })),
    finalPercentage: d.final_percentage,
    finalCgpa: d.final_cgpa,
    convertedGrade: d.converted_grade,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: 0.95,
    extractedAt: new Date(),
    extractedData: d,
  };
}

function mapGapAnalysisFromAgent(d) {
  if (!d) return null;
  return {
    hasGaps: d.has_gaps,
    totalGaps: d.total_gaps,
    gaps: (d.gaps || []).map((gap) => ({
      gapType: gap.gap_type,
      gapYears: gap.gap_years,
      fromEducation: gap.from_education,
      toEducation: gap.to_education,
      isSignificant: gap.is_significant,
      explanation: gap.explanation,
    })),
    overallAssessment: d.overall_assessment,
    timelineConsistent: d.timeline_consistent,
    analyzedAt: new Date(),
  };
}

function mapProcessingStatus(pythonStatus) {
  const statusMap = {
    success: "completed",
    partial: "completed",
    failed: "failed",
  };
  return statusMap[pythonStatus] || "completed";
}

// ========== CONTROLLERS ==========

exports.extractClass10 = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log(`\n📋 Starting Class 10 extraction for user: ${userId}`);

  if (!req.files || !req.files.pdf_10th) {
    throw new AppError("Class 10 marksheet PDF is required", 400);
  }

  try {
    const agentResponse = await callAgentServer("/extract/class10", req.files);

    if (!agentResponse?.success || !agentResponse?.data) {
      throw new AppError("Extraction failed - no data returned", 422);
    }

    const uploadResult = await uploadAcademicDocument(
      req.files.pdf_10th[0].path,
      userId,
      "class10"
    );

    let academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) {
      console.log("📝 Creating new academic record");
      academicRecord = new AcademicRecords({ user: userId });
    }

    if (academicRecord.class10?.documentPublicId) {
      console.log("🗑️ Deleting old Class 10 document");
      await deleteAcademicDocument(
        academicRecord.class10.documentPublicId,
        academicRecord.class10.documentResourceType
      );
    }

    academicRecord.class10 = mapClass10FromAgent(
      agentResponse.data,
      uploadResult
    );
    academicRecord.processingStatus = "completed";
    academicRecord.aiProcessingMetadata = {
      sessionId: agentResponse.session_id,
      modelUsed: "gemini-2.5-flash",
      totalDocumentsProcessed: 1,
      processingErrors: [],
    };

    academicRecord.updateVerificationStatus?.();
    await academicRecord.save();

    await Student.findByIdAndUpdate(userId, {
      academicRecords: academicRecord._id,
    });

    console.log("✅ Class 10 extraction completed successfully");

    return res.status(200).json({
      success: true,
      message: "Class 10 marksheet extracted successfully",
      data: {
        class10: academicRecord.class10,
        processingTime: agentResponse.processing_time_seconds,
      },
    });
  } catch (error) {
    console.error("❌ Class 10 extraction failed:", error);
    throw error;
  } finally {
    cleanupTempFiles(req.files);
  }
});

exports.extractClass12 = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log(`\n📋 Starting Class 12 extraction for user: ${userId}`);

  if (!req.files || !req.files.pdf_12th) {
    throw new AppError("Class 12 marksheet PDF is required", 400);
  }

  try {
    const agentResponse = await callAgentServer("/extract/class12", req.files);

    if (!agentResponse?.success || !agentResponse?.data) {
      throw new AppError("Extraction failed - no data returned", 422);
    }

    const uploadResult = await uploadAcademicDocument(
      req.files.pdf_12th[0].path,
      userId,
      "class12"
    );

    let academicRecord = await AcademicRecords.findOne({ user: userId });
    if (!academicRecord) {
      console.log("📝 Creating new academic record");
      academicRecord = new AcademicRecords({ user: userId });
    }

    if (academicRecord.class12?.documentPublicId) {
      console.log("🗑️ Deleting old Class 12 document");
      await deleteAcademicDocument(
        academicRecord.class12.documentPublicId,
        academicRecord.class12.documentResourceType
      );
    }

    academicRecord.class12 = mapClass12FromAgent(
      agentResponse.data,
      uploadResult
    );
    academicRecord.processingStatus = "completed";
    academicRecord.aiProcessingMetadata = {
      sessionId: agentResponse.session_id,
      modelUsed: "gemini-2.5-flash",
      totalDocumentsProcessed: 1,
      processingErrors: [],
    };

    academicRecord.updateVerificationStatus?.();
    await academicRecord.save();

    await Student.findByIdAndUpdate(userId, {
      academicRecords: academicRecord._id,
    });

    console.log("✅ Class 12 extraction completed successfully");

    return res.status(200).json({
      success: true,
      message: "Class 12 marksheet extracted successfully",
      data: {
        class12: academicRecord.class12,
        processingTime: agentResponse.processing_time_seconds,
      },
    });
  } catch (error) {
    console.error("❌ Class 12 extraction failed:", error);
    throw error;
  } finally {
    cleanupTempFiles(req.files);
  }
});

exports.extractComplete = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📋 Starting COMPLETE extraction for user: ${userId}`);
  console.log(`${"=".repeat(70)}`);

  if (
    !req.files ||
    (!req.files.pdf_10th && !req.files.pdf_12th && !req.files.pdf_graduation)
  ) {
    throw new AppError("At least one academic document is required", 400);
  }

  console.log("📁 Files received:", {
    class10: !!req.files.pdf_10th,
    class12: !!req.files.pdf_12th,
    graduation: !!req.files.pdf_graduation,
  });

  try {
    // Step 1: Call Python agent
    console.log("\n🔄 STEP 1: Calling Python agent...");
    const agentResponse = await callAgentServer("/extract/complete", req.files);

    if (!agentResponse?.success) {
      throw new AppError("Extraction failed - agent returned error", 422);
    }

    const extractedData = agentResponse.data;
    console.log("📊 Extraction results:", {
      class10: !!extractedData.class_10,
      class12: !!extractedData.class_12,
      graduation: !!extractedData.graduation,
      gapAnalysis: !!extractedData.gap_analysis,
    });

    // Step 2: Upload documents to Cloudinary
    console.log("\n📤 STEP 2: Uploading to Cloudinary...");
    const uploads = {};

    if (req.files.pdf_10th && extractedData.class_10) {
      console.log("📤 Uploading Class 10...");
      uploads.class10 = await uploadAcademicDocument(
        req.files.pdf_10th[0].path,
        userId,
        "class10"
      );
    }

    if (req.files.pdf_12th && extractedData.class_12) {
      console.log("📤 Uploading Class 12...");
      uploads.class12 = await uploadAcademicDocument(
        req.files.pdf_12th[0].path,
        userId,
        "class12"
      );
    }

    if (req.files.pdf_graduation && extractedData.graduation) {
      console.log("📤 Uploading Graduation...");
      uploads.graduation = await uploadAcademicDocument(
        req.files.pdf_graduation[0].path,
        userId,
        "graduation"
      );
    }

    console.log(
      `\n✅ ${Object.keys(uploads).length} documents uploaded successfully`
    );

    // Step 3: Database operations
    console.log("\n💾 STEP 3: Saving to database...");
    let academicRecord = await AcademicRecords.findOne({ user: userId });

    if (!academicRecord) {
      console.log("📝 Creating new academic record");
      academicRecord = new AcademicRecords({ user: userId });
    }

    // Delete old documents
    const deletePromises = [];
    if (uploads.class10 && academicRecord.class10?.documentPublicId) {
      deletePromises.push(
        deleteAcademicDocument(
          academicRecord.class10.documentPublicId,
          academicRecord.class10.documentResourceType
        )
      );
    }

    if (uploads.class12 && academicRecord.class12?.documentPublicId) {
      deletePromises.push(
        deleteAcademicDocument(
          academicRecord.class12.documentPublicId,
          academicRecord.class12.documentResourceType
        )
      );
    }

    if (uploads.graduation && academicRecord.graduation?.documentPublicId) {
      deletePromises.push(
        deleteAcademicDocument(
          academicRecord.graduation.documentPublicId,
          academicRecord.graduation.documentResourceType
        )
      );
    }

    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }

    // Map data
    if (uploads.class10 && extractedData.class_10) {
      console.log("💾 Saving Class 10 data");
      academicRecord.class10 = mapClass10FromAgent(
        extractedData.class_10,
        uploads.class10
      );
    }

    if (uploads.class12 && extractedData.class_12) {
      console.log("💾 Saving Class 12 data");
      academicRecord.class12 = mapClass12FromAgent(
        extractedData.class_12,
        uploads.class12
      );
    }

    if (uploads.graduation && extractedData.graduation) {
      console.log("💾 Saving Graduation data");
      academicRecord.graduation = mapGraduationFromAgent(
        extractedData.graduation,
        uploads.graduation
      );
    }

    if (extractedData.gap_analysis) {
      console.log("💾 Saving Gap Analysis");
      academicRecord.gapAnalysis = mapGapAnalysisFromAgent(
        extractedData.gap_analysis
      );
    }

    // Update metadata
    academicRecord.processingStatus = mapProcessingStatus(extractedData.status);
    academicRecord.processingTimeSeconds =
      agentResponse.processing_time_seconds;
    academicRecord.aiProcessingMetadata = {
      sessionId: agentResponse.session_id,
      modelUsed: "gemini-2.5-flash",
      totalDocumentsProcessed: Object.keys(uploads).length,
      processingErrors: extractedData.errors || [],
    };

    academicRecord.updateVerificationStatus?.();

    console.log("💾 Saving to database...");
    await academicRecord.save();
    console.log("✅ Saved to database");

    await Student.findByIdAndUpdate(userId, {
      academicRecords: academicRecord._id,
    });
    console.log("✅ Student record updated");

    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ COMPLETE EXTRACTION SUCCESSFUL`);
    console.log(` Processing time: ${agentResponse.processing_time_seconds}s`);
    console.log(`${"=".repeat(70)}\n`);

    return res.status(200).json({
      success: true,
      message: "Complete academic record extracted successfully",
      data: {
        academicRecord: {
          class10: academicRecord.class10,
          class12: academicRecord.class12,
          graduation: academicRecord.graduation,
          gapAnalysis: academicRecord.gapAnalysis,
        },
        processingTime: agentResponse.processing_time_seconds,
        status: academicRecord.processingStatus,
      },
    });
  } catch (error) {
    console.error("\n❌ COMPLETE EXTRACTION FAILED");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack?.split("\n").slice(0, 3).join("\n"));
    throw error;
  } finally {
    cleanupTempFiles(req.files);
  }
});

exports.getAcademicRecords = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const academicRecord = await AcademicRecords.findOne({ user: userId })
    .select(
      "-class10.extractedData -class12.extractedData -graduation.extractedData"
    )
    .lean();

  if (!academicRecord) {
    throw new AppError("No academic records found", 404);
  }

  return res.status(200).json({
    success: true,
    data: academicRecord,
  });
});

exports.deleteAcademicRecord = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { recordType } = req.params;

  if (!["class10", "class12", "graduation"].includes(recordType)) {
    throw new AppError("Invalid record type", 400);
  }

  const academicRecord = await AcademicRecords.findOne({ user: userId });

  if (!academicRecord) {
    throw new AppError("No academic records found", 404);
  }

  const record = academicRecord[recordType];
  if (record?.documentPublicId) {
    await deleteAcademicDocument(
      record.documentPublicId,
      record.documentResourceType
    );
  }

  academicRecord[recordType] = undefined;
  academicRecord.updateVerificationStatus?.();
  await academicRecord.save();

  return res.status(200).json({
    success: true,
    message: `${recordType} record deleted successfully`,
  });
});

exports.healthCheck = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${AGENT_SERVER_URL}/health`, {
      timeout: 5000,
    });

    return res.status(200).json({
      success: true,
      message: "Python agent server is reachable",
      agentStatus: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Python agent server is unreachable",
      error: error.message,
    });
  }
});

// ========== ✅ NEW FUNCTION - ISSUE 1 FIX ==========

/**
 * Check academic completeness - FIXED VERSION
 * GET /api/students/:studentId/academic/completeness
 */
exports.checkAcademicCompleteness = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  console.log(`\n📊 [Completeness Check] Student ID: ${studentId}`);

  const academicRecord = await AcademicRecords.findOne({
    user: studentId,
  }).lean();

  // No record found - all documents missing
  if (!academicRecord) {
    console.log("❌ No academic record found - 0% complete");
    return res.status(200).json({
      success: true,
      completeness: 0,
      missingDocuments: [
        "Class 10 Marksheet",
        "Class 12 Marksheet",
        "Graduation Marksheet",
      ],
      uploadedDocuments: [],
      status: "incomplete",
    });
  }

  // ✅ FIX: Check ACTUAL document URL presence (not just status)
  const documentChecks = {
    class10: {
      name: "Class 10 Marksheet",
      uploaded: !!(
        academicRecord.class10?.documentUrl &&
        academicRecord.class10.documentUrl.length > 0
      ),
    },
    class12: {
      name: "Class 12 Marksheet",
      uploaded: !!(
        academicRecord.class12?.documentUrl &&
        academicRecord.class12.documentUrl.length > 0
      ),
    },
    graduation: {
      name: "Graduation Marksheet",
      uploaded: !!(
        academicRecord.graduation?.documentUrl &&
        academicRecord.graduation.documentUrl.length > 0
      ),
    },
  };

  const uploadedDocuments = [];
  const missingDocuments = [];

  Object.entries(documentChecks).forEach(([key, doc]) => {
    if (doc.uploaded) {
      uploadedDocuments.push(doc.name);
    } else {
      missingDocuments.push(doc.name);
    }
  });

  const completeness = Math.round((uploadedDocuments.length / 3) * 100);
  const status = completeness === 100 ? "complete" : "incomplete";

  console.log(`✅ Completeness: ${completeness}%`);
  console.log(`   Uploaded: ${uploadedDocuments.join(", ") || "None"}`);
  console.log(`   Missing: ${missingDocuments.join(", ") || "None"}`);

  return res.status(200).json({
    success: true,
    completeness,
    uploadedDocuments,
    missingDocuments,
    status,
    details: {
      class10: documentChecks.class10.uploaded,
      class12: documentChecks.class12.uploaded,
      graduation: documentChecks.graduation.uploaded,
    },
  });
});
