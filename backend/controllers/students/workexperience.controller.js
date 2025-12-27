// controllers/students/workexperience.controller.js

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const WorkExperienceRecord = require("../../models/student/Workexperience");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const { updateStudentDocumentHash } = require("../../utils/documentHasher");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

const WORK_AGENT_URL = process.env.WORK_AGENT_URL || "http://localhost:7005";

// ========== HELPERS ==========

async function uploadWorkDocument(filePath, userId, docType) {
  console.log(`\n📤 [UPLOAD START] ${docType}`);
  console.log(`   File path: ${filePath}`);
  console.log(`   File exists: ${fs.existsSync(filePath)}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const publicId = `students/${userId}/work/${docType}_${Date.now()}`;

  console.log(`   Cloudinary public_id: ${publicId}`);
  console.log(`   Calling uploadToCloudinary...`);

  try {
    const result = await uploadToCloudinary(filePath, {
      folder: `students/${userId}/work`,
      resource_type: "raw",
      type: "authenticated",
      public_id: publicId,
    });

    console.log(`   Raw Cloudinary result:`, JSON.stringify(result, null, 2));

    if (!result) {
      throw new Error("uploadToCloudinary returned null/undefined");
    }

    const uploadResult = {
      url: result.secure_url || result.url,
      publicId: result.public_id || publicId,
      resourceType: result.resource_type || "raw",
      type: "authenticated",
    };

    console.log(`   Mapped result:`, JSON.stringify(uploadResult, null, 2));

    if (!uploadResult.url) {
      console.error(`   ❌ ERROR: No URL in result!`);
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

async function deleteWorkDocument(publicId, resourceType = "raw") {
  if (!publicId) return;

  try {
    await deleteFromCloudinary({
      publicId,
      resourceType,
      type: "authenticated",
    });
    console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error(`⚠️ Failed to delete from Cloudinary: ${publicId}`, error);
  }
}

async function callWorkAgent(files) {
  const form = new FormData();

  // Experience letters (MANDATORY)
  if (files.experience_letters?.length) {
    files.experience_letters.forEach((file) => {
      form.append(
        "experience_letters",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
    console.log(
      `📤 Added ${files.experience_letters.length} experience letters`
    );
  } else {
    throw new AppError("Experience letters are MANDATORY", 400);
  }

  // Optional documents
  if (files.offer_letters?.length) {
    files.offer_letters.forEach((file) => {
      form.append(
        "offer_letters",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
    console.log(`📤 Added ${files.offer_letters.length} offer letters`);
  }

  if (files.relieving_letters?.length) {
    files.relieving_letters.forEach((file) => {
      form.append(
        "relieving_letters",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
    console.log(`📤 Added ${files.relieving_letters.length} relieving letters`);
  }

  if (files.salary_slips?.length) {
    files.salary_slips.forEach((file) => {
      form.append(
        "salary_slips",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
    console.log(`📤 Added ${files.salary_slips.length} salary slips`);
  }

  if (files.other_documents?.length) {
    files.other_documents.forEach((file) => {
      form.append(
        "other_documents",
        fs.createReadStream(file.path),
        file.originalname
      );
    });
    console.log(`📤 Added ${files.other_documents.length} other documents`);
  }

  // Add threshold_strength parameter
  form.append("threshold_strength", "none"); // Recommended for AI

  try {
    console.log(`📞 Calling Python work agent: ${WORK_AGENT_URL}/process`);
    const response = await axios.post(`${WORK_AGENT_URL}/process`, form, {
      headers: { ...form.getHeaders() },
      timeout: 300000, // 5 minutes
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log("✅ Work agent response received");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Work agent error:",
      error.response?.data || error.message
    );
    throw new AppError(
      `Work extraction failed: ${error.response?.data?.error || error.message}`,
      500
    );
  }
}

function cleanupTempFiles(files) {
  const allFiles = [
    ...(files.experience_letters || []),
    ...(files.offer_letters || []),
    ...(files.relieving_letters || []),
    ...(files.salary_slips || []),
    ...(files.other_documents || []),
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

// ========== CONTROLLERS ==========

exports.submitWorkExperience = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized - User ID not found", 401);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`💼 PROCESSING WORK EXPERIENCE FOR USER: ${userId}`);
  console.log(`${"=".repeat(70)}`);

  // Validate mandatory files
  if (!req.files?.experience_letters?.length) {
    throw new AppError("Experience letters are MANDATORY", 400);
  }

  // Limit number of files
  const totalFiles =
    (req.files.experience_letters?.length || 0) +
    (req.files.offer_letters?.length || 0) +
    (req.files.relieving_letters?.length || 0) +
    (req.files.salary_slips?.length || 0) +
    (req.files.other_documents?.length || 0);

  if (totalFiles > 10) {
    throw new AppError("Maximum 10 documents allowed in total", 400);
  }

  console.log("📋 Files received:", {
    experienceLetters: req.files.experience_letters?.length || 0,
    offerLetters: req.files.offer_letters?.length || 0,
    relievingLetters: req.files.relieving_letters?.length || 0,
    salarySlips: req.files.salary_slips?.length || 0,
    otherDocuments: req.files.other_documents?.length || 0,
    total: totalFiles,
  });

  let agentResponse = null;
  const uploadedDocuments = [];

  try {
    // Step 1: Call Python agent for extraction
    console.log("\n📞 STEP 1: Calling Python work agent...");
    agentResponse = await callWorkAgent(req.files);

    if (!agentResponse?.session_id) {
      throw new AppError("Extraction failed - no session ID returned", 422);
    }

    console.log(`✅ Session ID: ${agentResponse.session_id}`);
    console.log(`📊 Status: ${agentResponse.status}`);
    console.log(
      `💼 Work Experiences: ${agentResponse.work_experiences?.length || 0}`
    );
    console.log(
      `✅ Valid Experiences: ${agentResponse.valid_experiences || 0}`
    );

    // Step 2: Upload documents to Cloudinary
    console.log("\n☁️ STEP 2: Uploading documents to Cloudinary...");

    // Upload experience letters (mandatory)
    if (req.files.experience_letters?.length) {
      for (let i = 0; i < req.files.experience_letters.length; i++) {
        const file = req.files.experience_letters[i];
        console.log(`📤 Uploading experience letter ${i + 1}...`);
        const uploadResult = await uploadWorkDocument(
          file.path,
          userId,
          `experience_letter_${i + 1}`
        );
        uploadedDocuments.push({
          ...uploadResult,
          documentType: "experience_letter",
          isMandatory: true,
        });
      }
    }

    // Upload optional documents
    const optionalDocs = [
      { files: req.files.offer_letters, type: "offer_letter" },
      { files: req.files.relieving_letters, type: "relieving_letter" },
      { files: req.files.salary_slips, type: "salary_slip" },
      { files: req.files.other_documents, type: "other" },
    ];

    for (const docGroup of optionalDocs) {
      if (docGroup.files?.length) {
        for (let i = 0; i < docGroup.files.length; i++) {
          const file = docGroup.files[i];
          console.log(`📤 Uploading ${docGroup.type} ${i + 1}...`);
          const uploadResult = await uploadWorkDocument(
            file.path,
            userId,
            `${docGroup.type}_${i + 1}`
          );
          uploadedDocuments.push({
            ...uploadResult,
            documentType: docGroup.type,
            isMandatory: false,
          });
        }
      }
    }

    console.log(
      `\n✅ ${uploadedDocuments.length} documents uploaded successfully`
    );

    // Step 3: Map work experiences with Cloudinary URLs
    console.log("\n💾 STEP 3: Mapping work experiences with document URLs...");

    const workExperiences = (agentResponse.work_experiences || []).map(
      (exp, index) => {
        // Find the corresponding Cloudinary document for this experience
        // For now, we'll link the first experience letter to the first experience
        const correspondingDoc =
          uploadedDocuments.find(
            (doc) => doc.documentType === exp.source_document_type
          ) || uploadedDocuments[0];

        return {
          companyName: exp.company_name,
          jobTitle: exp.job_title,
          employmentType: exp.employment_type,
          startDate: exp.start_date,
          endDate: exp.end_date,
          currentlyWorking: exp.currently_working,
          isPaid: exp.is_paid,
          stipendAmount: exp.stipend_amount,
          extractionConfidence: exp.extraction_confidence,
          documentQuality: exp.document_quality,
          notes: exp.notes,
          sourceDocumentType: exp.source_document_type,
          hasExperienceLetter: exp.has_experience_letter,
          documentUrl: correspondingDoc?.url,
          documentPublicId: correspondingDoc?.publicId,
          documentResourceType: correspondingDoc?.resourceType,
          documentType: correspondingDoc?.type,
          extractedData: exp, // Store full data
        };
      }
    );

    // Step 4: Map verifications
    const verifications = (agentResponse.verifications || []).map((ver) => ({
      valid: ver.valid,
      confidence: ver.confidence,
      reason: ver.reason,
      issues: ver.issues || [],
      warnings: ver.warnings || [],
      hasMandatoryDocuments: ver.has_mandatory_documents,
    }));

    // Step 5: Map documents
    const documents = (agentResponse.documents || []).map((doc) => ({
      filename: doc.filename,
      path: doc.path,
      extension: doc.extension,
      sizeMb: doc.size_mb,
      pageCount: doc.page_count,
      qualityScore: doc.quality_score,
      documentType: doc.document_type,
      isMandatory: doc.is_mandatory,
    }));

    // Step 6: Save to database
    console.log("\n💾 STEP 4: Saving to database...");

    // Delete old work experience record if exists
    const existingRecord = await WorkExperienceRecord.findOne({ user: userId });
    if (existingRecord) {
      console.log("🗑️ Deleting old work experience record and documents...");

      // Delete old documents from Cloudinary
      for (const exp of existingRecord.workExperiences) {
        if (exp.documentPublicId) {
          await deleteWorkDocument(
            exp.documentPublicId,
            exp.documentResourceType
          );
        }
      }

      // Delete old record
      await WorkExperienceRecord.deleteOne({ _id: existingRecord._id });
    }

    // Create new record
    const workRecord = new WorkExperienceRecord({
      user: userId,
      sessionId: agentResponse.session_id,
      processingTimestamp: new Date(),
      workExperiences,
      verifications,
      documents,
      totalDocuments: agentResponse.total_documents,
      mandatoryDocumentsCount: agentResponse.mandatory_documents_count,
      optionalDocumentsCount: agentResponse.optional_documents_count,
      validExperiences: agentResponse.valid_experiences,
      totalYearsExperience: agentResponse.total_years_experience,
      hasAllMandatoryDocuments: agentResponse.has_all_mandatory_documents,
      missingMandatoryDocuments:
        agentResponse.missing_mandatory_documents || [],
      processingTimeSeconds: agentResponse.processing_time_seconds,
      status: agentResponse.status,
      errors: agentResponse.errors || [],
      aiProcessingMetadata: {
        modelUsed: "gemini-2.5-flash",
        extractionMethod: "work-experience-agent-v1",
        processingErrors: agentResponse.errors || [],
      },
    });

    workRecord.updateVerificationStatus();
    await workRecord.save();

    // Update student reference
    await Student.findByIdAndUpdate(userId, {
      $set: { workExperience: workRecord._id },
    });

    console.log("✅ Work experience record saved successfully");

    await updateStudentDocumentHash(userId);

    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ WORK EXPERIENCE PROCESSING COMPLETE`);
    console.log(`   Status: ${workRecord.status}`);
    console.log(`   Valid Experiences: ${workRecord.validExperiences}`);
    console.log(
      `   Total Experience: ${workRecord.totalYearsExperience || 0} years`
    );
    console.log(`   Processing Time: ${workRecord.processingTimeSeconds}s`);
    console.log(`${"=".repeat(70)}\n`);

    // Prepare response
    const responseData = {
      _id: workRecord._id,
      sessionId: workRecord.sessionId,
      status: workRecord.status,
      statusColor: workRecord.statusColor,

      summary: {
        totalDocuments: workRecord.totalDocuments,
        mandatoryDocuments: workRecord.mandatoryDocumentsCount,
        optionalDocuments: workRecord.optionalDocumentsCount,
        totalExperiences: workRecord.workExperiences.length,
        validExperiences: workRecord.validExperiences,
        totalYearsExperience: workRecord.totalYearsExperience,
        hasAllMandatoryDocuments: workRecord.hasAllMandatoryDocuments,
        completionPercentage: workRecord.completionPercentage,
      },

      workExperiences: workRecord.workExperiences.map((exp, i) => ({
        companyName: exp.companyName,
        jobTitle: exp.jobTitle,
        employmentType: exp.employmentType,
        startDate: exp.startDate,
        endDate: exp.endDate,
        currentlyWorking: exp.currentlyWorking,
        isPaid: exp.isPaid,
        stipendAmount: exp.stipendAmount,
        hasExperienceLetter: exp.hasExperienceLetter,
        extractionConfidence: exp.extractionConfidence,
        verification: verifications[i],
      })),

      processing: {
        time: workRecord.processingTimeSeconds,
        evaluatedAt: workRecord.processingTimestamp,
        errors: workRecord.errors,
      },
    };

    return res.status(200).json({
      success: true,
      message: "Work experience processed successfully",
      processingTime: workRecord.processingTimeSeconds,
      data: responseData,
    });
  } catch (error) {
    console.error("\n❌ WORK EXPERIENCE PROCESSING FAILED");
    console.error("Error:", error.message);

    // Cleanup uploaded documents on error
    for (const doc of uploadedDocuments) {
      if (doc.publicId) {
        try {
          await deleteWorkDocument(doc.publicId, doc.resourceType);
        } catch (cleanupError) {
          console.error("⚠️ Failed to cleanup document:", cleanupError.message);
        }
      }
    }

    throw error;
  } finally {
    cleanupTempFiles(req.files);
  }
});

exports.getWorkExperience = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const workRecord = await WorkExperienceRecord.findOne({ user: userId })
    .select("-workExperiences.extractedData")
    .lean();

  if (!workRecord) {
    throw new AppError("No work experience found", 404);
  }

  // Add virtuals
  workRecord.statusColor =
    workRecord.status === "success"
      ? "#10b981"
      : workRecord.status === "partial"
      ? "#f59e0b"
      : workRecord.status === "failed"
      ? "#ef4444"
      : "#6b7280";

  workRecord.hasValidExperiences = workRecord.validExperiences > 0;
  workRecord.completionPercentage =
    workRecord.workExperiences.length > 0
      ? Math.round(
          (workRecord.validExperiences / workRecord.workExperiences.length) *
            100
        )
      : 0;

  return res.status(200).json({
    success: true,
    data: workRecord,
  });
});

exports.deleteWorkExperience = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const workRecord = await WorkExperienceRecord.findOne({ user: userId });
  if (!workRecord) {
    throw new AppError("No work experience found", 404);
  }

  // Delete all documents from Cloudinary
  for (const exp of workRecord.workExperiences) {
    if (exp.documentPublicId) {
      await deleteWorkDocument(exp.documentPublicId, exp.documentResourceType);
    }
  }

  // Delete record
  await WorkExperienceRecord.deleteOne({ _id: workRecord._id });

  // Remove reference from student
  await Student.findByIdAndUpdate(userId, {
    $unset: { workExperience: "" },
  });

  return res.status(200).json({
    success: true,
    message: "Work experience deleted successfully",
  });

  await updateStudentDocumentHash(userId);
});

exports.healthCheck = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${WORK_AGENT_URL}/health`, {
      timeout: 5000,
    });

    return res.status(200).json({
      success: true,
      message: "Work agent is reachable",
      agentStatus: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Work agent is unreachable",
      error: error.message,
    });
  }
});
