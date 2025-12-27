// controllers/students/testscores.controller.js - SMART SINGLE ROUTE VERSION

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const TestScores = require("../../models/student/TestScores");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const { updateStudentDocumentHash } = require("../../utils/documentHasher");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

const TEST_SCORE_SERVER_URL =
  process.env.TEST_SCORE_SERVER_URL || "http://localhost:7006";

// ========== FILE NAME MAPPING ==========
const FILE_MAPPING = {
  toefl_report: {
    endpoint: "/process/toefl",
    testType: "toefl",
    scoreField: "toeflScore",
    mapper: mapTOEFLFromPython,
  },
  gre_report: {
    endpoint: "/process/gre",
    testType: "gre",
    scoreField: "greScore",
    mapper: mapGREFromPython,
  },
  ielts_report: {
    endpoint: "/process/ielts",
    testType: "ielts",
    scoreField: "ieltsScore",
    mapper: mapIELTSFromPython,
  },
};

// ========== HELPERS ==========

async function uploadTestDocument(filePath, userId, testType) {
  console.log(`\n📤 [UPLOAD START] ${testType}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const publicId = `students/${userId}/testscores/${testType}_${Date.now()}`;

  try {
    const result = await uploadToCloudinary(filePath, {
      folder: `students/${userId}/testscores`,
      resource_type: "raw",
      type: "authenticated",
      public_id: publicId,
    });

    if (!result || !result.secure_url) {
      throw new Error("Cloudinary upload failed - no URL returned");
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type || "raw",
      type: "authenticated",
    };
  } catch (error) {
    console.error(`❌ [UPLOAD FAILED] ${testType}:`, error);
    throw new Error(`Upload failed for ${testType}: ${error.message}`);
  }
}

async function deleteTestDocument(publicId, resourceType = "raw") {
  if (!publicId) return;

  try {
    await deleteFromCloudinary({
      publicId,
      resourceType,
      type: "authenticated",
    });
    console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error(`⚠️ Failed to delete: ${publicId}`, error);
  }
}

async function callTestScoreServer(endpoint, file, fieldName) {
  const form = new FormData();
  form.append(fieldName, fs.createReadStream(file.path));

  try {
    console.log(`📡 Calling: ${TEST_SCORE_SERVER_URL}${endpoint}`);

    const response = await axios.post(
      `${TEST_SCORE_SERVER_URL}${endpoint}`,
      form,
      {
        headers: { ...form.getHeaders() },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ Python server responded");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Python server error:",
      error.response?.data || error.message
    );

    if (error.code === "ECONNREFUSED") {
      throw new AppError(
        "Test score server unavailable. Please try again later.",
        503
      );
    }

    throw new AppError(
      `Extraction failed: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
}

function cleanupTempFiles(files) {
  if (!files) return;

  Object.values(files).forEach((fileArray) => {
    fileArray.forEach((file) => {
      try {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Cleaned: ${file.path}`);
        }
      } catch (err) {
        console.error("⚠️ Cleanup error:", err);
      }
    });
  });
}

function mapTOEFLFromPython(pythonData, uploadResult) {
  const data = pythonData.toefl_score || pythonData;

  return {
    reading: data.reading,
    listening: data.listening,
    speaking: data.speaking,
    writing: data.writing,
    totalScore: data.total_score,
    testDate: data.test_date ? new Date(data.test_date) : undefined,
    registrationNumber: data.registration_number,
    testCenter: data.test_center,
    scoreValidityDate: data.score_validity_date
      ? new Date(data.score_validity_date)
      : undefined,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: data.extraction_confidence || 0.95,
    extractedAt: new Date(),
    isVerified: data.is_verified || false,
    verificationIssues: data.verification_issues || [],
    verificationWarnings: data.warnings || [],
    extractedData: data,
  };
}

function mapGREFromPython(pythonData, uploadResult) {
  const data = pythonData.gre_score || pythonData;

  return {
    verbalReasoning: data.verbal_reasoning,
    quantitativeReasoning: data.quantitative_reasoning,
    analyticalWriting: data.analytical_writing,
    testDate: data.test_date ? new Date(data.test_date) : undefined,
    registrationNumber: data.registration_number,
    testCenter: data.test_center,
    scoreValidityDate: data.score_validity_date
      ? new Date(data.score_validity_date)
      : undefined,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: data.extraction_confidence || 0.95,
    extractedAt: new Date(),
    isVerified: data.is_verified || false,
    verificationIssues: data.verification_issues || [],
    verificationWarnings: data.warnings || [],
    extractedData: data,
  };
}

function mapIELTSFromPython(pythonData, uploadResult) {
  const data = pythonData.ielts_score || pythonData;

  return {
    listening: data.listening,
    reading: data.reading,
    writing: data.writing,
    speaking: data.speaking,
    overallBandScore: data.overall_band_score,
    testDate: data.test_date ? new Date(data.test_date) : undefined,
    candidateNumber: data.candidate_number,
    testCenter: data.test_center,
    testReportFormNumber: data.test_report_form_number,
    testType: data.test_type,
    documentUrl: uploadResult.url,
    documentPublicId: uploadResult.publicId,
    documentResourceType: uploadResult.resourceType,
    documentType: uploadResult.type,
    extractionStatus: "success",
    extractionConfidence: data.extraction_confidence || 0.95,
    extractedAt: new Date(),
    isVerified: data.is_verified || false,
    verificationIssues: data.verification_issues || [],
    verificationWarnings: data.warnings || [],
    extractedData: data,
  };
}

// ========== MAIN CONTROLLER: SMART SINGLE ROUTE ==========

/**
 * 🎯 SMART EXTRACTION - Handles TOEFL/GRE/IELTS intelligently
 * POST /api/user/testscores/extract
 *
 * Accepts optional files:
 * - toefl_report (PDF/PNG/JPG)
 * - gre_report (PDF/PNG/JPG)
 * - ielts_report (PDF/PNG/JPG)
 *
 * Processes only the files provided, returns all results
 */
exports.smartExtract = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎯 SMART EXTRACTION for user: ${userId}`);
  console.log(`${"=".repeat(70)}`);

  if (!req.files || Object.keys(req.files).length === 0) {
    throw new AppError(
      "At least one test score document is required (toefl_report, gre_report, or ielts_report)",
      400
    );
  }

  const uploadedFiles = Object.keys(req.files);
  console.log(`📁 Files received: ${uploadedFiles.join(", ")}`);

  // Validate file names
  const invalidFiles = uploadedFiles.filter((name) => !FILE_MAPPING[name]);
  if (invalidFiles.length > 0) {
    throw new AppError(
      `Invalid file names: ${invalidFiles.join(
        ", "
      )}. Use: toefl_report, gre_report, or ielts_report`,
      400
    );
  }

  const results = {
    processed: [],
    failed: [],
    totalProcessingTime: 0,
  };

  try {
    // Get or create test scores record
    let testScores = await TestScores.findOne({ user: userId });
    if (!testScores) {
      console.log("📝 Creating new test scores record");
      testScores = new TestScores({ user: userId });
    }

    // Process each uploaded file
    for (const [fileName, fileConfig] of Object.entries(FILE_MAPPING)) {
      if (!req.files[fileName]) {
        console.log(`⏭️  Skipping ${fileConfig.testType} (not provided)`);
        continue;
      }

      const file = req.files[fileName][0];
      console.log(`\n${"─".repeat(70)}`);
      console.log(`🔄 Processing ${fileConfig.testType.toUpperCase()}...`);
      console.log(`${"─".repeat(70)}`);

      try {
        // Step 1: Call Python server
        const pythonResponse = await callTestScoreServer(
          fileConfig.endpoint,
          file,
          fileName
        );

        if (!pythonResponse?.success || !pythonResponse?.data) {
          throw new Error(
            `No data returned from ${fileConfig.testType} extraction`
          );
        }

        // Step 2: Upload to Cloudinary
        const uploadResult = await uploadTestDocument(
          file.path,
          userId,
          fileConfig.testType
        );

        // Step 3: Delete old document if exists
        const oldScore = testScores[fileConfig.scoreField];
        if (oldScore?.documentPublicId) {
          console.log(`🗑️  Deleting old ${fileConfig.testType} document`);
          await deleteTestDocument(
            oldScore.documentPublicId,
            oldScore.documentResourceType
          );
        }

        // Step 4: Map and save data
        testScores[fileConfig.scoreField] = fileConfig.mapper(
          pythonResponse.data,
          uploadResult
        );

        results.processed.push({
          testType: fileConfig.testType,
          success: true,
          score: testScores[fileConfig.scoreField],
          processingTime: pythonResponse.processing_time_seconds,
          isVerified: testScores[fileConfig.scoreField].isVerified,
          verificationIssues:
            testScores[fileConfig.scoreField].verificationIssues,
        });

        results.totalProcessingTime +=
          pythonResponse.processing_time_seconds || 0;

        console.log(
          `✅ ${fileConfig.testType.toUpperCase()} processed successfully`
        );
      } catch (error) {
        console.error(
          `❌ ${fileConfig.testType.toUpperCase()} failed:`,
          error.message
        );

        results.failed.push({
          testType: fileConfig.testType,
          success: false,
          error: error.message,
        });
      }
    }

    // Update processing metadata
    if (results.processed.length > 0) {
      testScores.processingTimeSeconds = results.totalProcessingTime;
      testScores.aiProcessingMetadata = {
        sessionId: `smart_extract_${Date.now()}`,
        modelUsed: "gemini-2.0-flash-exp",
        extractionEngine: "gemini-2.0-flash-exp",
        verificationEngine: "llama-3.3-70b",
        processedTests: results.processed.map((r) => r.testType),
        processingErrors: results.failed.map(
          (r) => `${r.testType}: ${r.error}`
        ),
      };

      testScores.updateProcessingStatus();
      await testScores.save();

      // Update student reference
      await Student.findByIdAndUpdate(userId, {
        testScores: testScores._id,
      });

      await updateStudentDocumentHash(userId);
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ SMART EXTRACTION COMPLETED`);
    console.log(`   Processed: ${results.processed.length}`);
    console.log(`   Failed: ${results.failed.length}`);
    console.log(`   Total time: ${results.totalProcessingTime.toFixed(2)}s`);
    console.log(`${"=".repeat(70)}\n`);

    // Return response
    return res.status(results.processed.length > 0 ? 200 : 422).json({
      success: results.processed.length > 0,
      message:
        results.processed.length > 0
          ? `Successfully processed ${results.processed.length} test score(s)`
          : "All extractions failed",
      data: {
        processed: results.processed,
        failed: results.failed,
        totalProcessingTime: results.totalProcessingTime,
        summary: {
          total: uploadedFiles.length,
          successful: results.processed.length,
          failed: results.failed.length,
        },
      },
    });
  } catch (error) {
    console.error("\n❌ SMART EXTRACTION CRITICAL ERROR:", error);
    throw error;
  } finally {
    cleanupTempFiles(req.files);
  }
});

/**
 * Get Test Scores
 * GET /api/user/testscores
 */
exports.getTestScores = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const testScores = await TestScores.findOne({ user: userId })
    .select(
      "-toeflScore.extractedData -greScore.extractedData -ieltsScore.extractedData"
    )
    .lean();

  if (!testScores) {
    return res.status(200).json({
      success: true,
      data: null,
      message: "No test scores found",
    });
  }

  // Add validity status
  const now = new Date();

  if (testScores.toeflScore?.testDate) {
    const expiry = new Date(testScores.toeflScore.testDate);
    expiry.setFullYear(expiry.getFullYear() + 2);
    testScores.toeflScore.isValid = now <= expiry;
    testScores.toeflScore.expiryDate = expiry;
  }

  if (testScores.greScore?.testDate) {
    const expiry = new Date(testScores.greScore.testDate);
    expiry.setFullYear(expiry.getFullYear() + 5);
    testScores.greScore.isValid = now <= expiry;
    testScores.greScore.expiryDate = expiry;
  }

  if (testScores.ieltsScore?.testDate) {
    const expiry = new Date(testScores.ieltsScore.testDate);
    expiry.setFullYear(expiry.getFullYear() + 2);
    testScores.ieltsScore.isValid = now <= expiry;
    testScores.ieltsScore.expiryDate = expiry;
  }

  return res.status(200).json({
    success: true,
    data: testScores,
  });
});

/**
 * Delete Test Score
 * DELETE /api/user/testscores/:testType
 */
exports.deleteTestScore = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { testType } = req.params;

  if (!["toefl", "gre", "ielts"].includes(testType.toLowerCase())) {
    throw new AppError("Invalid test type. Use: toefl, gre, or ielts", 400);
  }

  const testScores = await TestScores.findOne({ user: userId });
  if (!testScores) {
    throw new AppError("No test scores found", 404);
  }

  const scoreField = `${testType}Score`;
  const score = testScores[scoreField];

  if (!score) {
    throw new AppError(`No ${testType.toUpperCase()} score found`, 404);
  }

  // Delete from Cloudinary
  if (score.documentPublicId) {
    await deleteTestDocument(
      score.documentPublicId,
      score.documentResourceType
    );
  }

  // Remove from database
  testScores[scoreField] = undefined;
  testScores.updateProcessingStatus();
  await testScores.save();

  console.log(`✅ ${testType.toUpperCase()} score deleted`);

  await updateStudentDocumentHash(userId);

  return res.status(200).json({
    success: true,
    message: `${testType.toUpperCase()} score deleted successfully`,
  });
});

/**
 * Health Check
 * GET /api/user/testscores/health
 */
exports.healthCheck = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${TEST_SCORE_SERVER_URL}/health`, {
      timeout: 5000,
    });

    return res.status(200).json({
      success: true,
      message: "Test score server is reachable",
      serverStatus: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Test score server is unavailable",
      error: error.message,
      serverUrl: TEST_SCORE_SERVER_URL,
    });
  }
});
