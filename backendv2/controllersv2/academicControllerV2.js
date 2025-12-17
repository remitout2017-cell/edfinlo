// controllersv2/academicControllerV2.js

const AcademicWorkflow =
  require("../ai/workflows/AcademicWorkflow").AcademicWorkflow;
const Student = require("../models/students");
const AcademicRecords = require("../models/AcademicRecords");
const AdmissionLetter = require("../models/AdmissionLetter");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const {
  compressAndEncryptImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");

// Helper: Prepare documents for workflow
const prepareDocsForWorkflow = (files) => {
  const documents = {
    class10: [],
    class12: [],
    undergraduate: [],
    postgraduate: [],
    admissionLetter: [],
  };

  if (!files) return documents;

  if (files.class10Marksheet)
    files.class10Marksheet.forEach((f) => documents.class10.push(f.path));
  if (files.class12Marksheet)
    files.class12Marksheet.forEach((f) => documents.class12.push(f.path));
  if (files.undergraduateMarksheets)
    files.undergraduateMarksheets.forEach((f) =>
      documents.undergraduate.push(f.path)
    );
  if (files.postgraduateMarksheets)
    files.postgraduateMarksheets.forEach((f) =>
      documents.postgraduate.push(f.path)
    );
  if (files.admissionLetter)
    files.admissionLetter.forEach((f) =>
      documents.admissionLetter.push(f.path)
    );

  return documents;
};

// ============================================================================
// 🚀 MAIN CONTROLLER
// ============================================================================
exports.processAcademicDocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let allFilePaths = [];

  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("No academic documents uploaded", 400);
    }

    Object.values(req.files)
      .flat()
      .forEach((f) => allFilePaths.push(f.path));

    console.log(`📚 Processing Academic Docs for user ${req.user._id}`);

    const workflowDocs = prepareDocsForWorkflow(req.files);
    const workflow = new AcademicWorkflow();
    const workflowResult = await workflow.processAcademics(workflowDocs);

    if (!workflowResult || !workflowResult.success) {
      throw new Error("AI Workflow failed");
    }

    const { results, verification, eligibilityCheck } = workflowResult;

    // Upload to Cloudinary
    console.log("☁️ Uploading encrypted documents...");
    const uploadMap = {};

    const uploadPromises = Object.entries(req.files).map(
      async ([field, fileArray]) => {
        uploadMap[field] = [];
        for (const file of fileArray) {
          const encryptedBuffer = await compressAndEncryptImage(file.path);
          const url = await uploadImageToCloudinary(
            encryptedBuffer,
            `kyc_documents/academics/${req.user.id}/${field}-${Date.now()}.jpg`
          );
          uploadMap[field].push(url);
          await deleteLocalFile(file.path);
        }
      }
    );

    await Promise.all(uploadPromises);

    // Save AcademicRecords
    console.log("💾 Saving Academic & Admission Data...");

    const academicDataPayload = {
      user: req.user._id, // ✅ Correct field name

      class10: results.class10
        ? {
            marksheets: [
              {
                documentUrl: uploadMap.class10Marksheet?.[0],
                institutionName:
                  results.class10.academicData?.institutionName ||
                  results.class10.academicData?.institution ||
                  null,
                boardUniversity:
                  results.class10.academicData?.boardUniversity ||
                  results.class10.academicData?.board ||
                  null,
                yearOfPassing: results.class10.academicData?.yearOfPassing,
                percentage: results.class10.academicData?.percentage,
                cgpa: results.class10.academicData?.cgpa,
                grade: results.class10.academicData?.grade,
                extractionStatus: "success",
                extractionConfidence:
                  (results.class10.academicData?.confidence || 0) / 100,
              },
            ],
            isVerified: true,
            verificationNotes: "AI verified",
            lastUpdated: new Date(),
          }
        : undefined,

      class12: results.class12
        ? {
            marksheets: [
              {
                documentUrl: uploadMap.class12Marksheet?.[0],
                institutionName:
                  results.class12.academicData?.institutionName ||
                  results.class12.academicData?.institution ||
                  null,
                boardUniversity:
                  results.class12.academicData?.boardUniversity ||
                  results.class12.academicData?.board ||
                  null,
                yearOfPassing: results.class12.academicData?.yearOfPassing,
                percentage: results.class12.academicData?.percentage,
                cgpa: results.class12.academicData?.cgpa,
                grade: results.class12.academicData?.grade,
                extractionStatus: "success",
                extractionConfidence:
                  (results.class12.academicData?.confidence || 0) / 100,
              },
            ],
            stream: results.class12.academicData?.stream || null,
            isVerified: true,
            verificationNotes: "AI verified",
            lastUpdated: new Date(),
          }
        : undefined,

      higherEducation: results.undergraduate
        ? [
            {
              educationType: "bachelor",
              courseName:
                results.undergraduate.academicData?.courseName ||
                results.undergraduate.academicData?.degree ||
                "Undergraduate Degree",
              specialization:
                results.undergraduate.academicData?.specialization || null,
              duration: results.undergraduate.academicData?.duration || null,
              marksheets: (uploadMap.undergraduateMarksheets || []).map(
                (url) => ({
                  documentUrl: url,
                  extractionStatus: "success",
                })
              ),
              isVerified: true,
              verificationNotes: "AI verified",
            },
          ]
        : [],

      overallVerificationStatus: verification?.isConsistent
        ? "complete"
        : "partial",
      lastVerifiedAt: new Date(),
    };

    let academicRecord = await AcademicRecords.findOne({ user: req.user._id });
    if (academicRecord) {
      academicRecord = await AcademicRecords.findOneAndUpdate(
        { user: req.user._id },
        { $set: academicDataPayload },
        { new: true, upsert: true }
      );
    } else {
      academicRecord = await AcademicRecords.create(academicDataPayload);
    }

    // Save AdmissionLetter (if provided)
    let admissionRecord = null;
    if (results.admission && uploadMap.admissionLetter?.[0]) {
      const a = results.admission.admissionData || {};

      // ✅ Match the exact AdmissionLetter schema fields
      const admissionPayload = {
        user: req.user._id, // ✅ CHANGED from 'student' to 'user'
        admissionLetterUrl: uploadMap.admissionLetter[0],
        status: "verified",
        universityName: a.universityName || a.institutionName || null,
        programName: a.programName || a.courseName || null,
        intakeTerm: a.intakeTerm || null,
        intakeYear: a.intakeYear || null,
        country: a.country || null,
        universityScore: a.universityScore || null,
        riskLevel: a.riskLevel || "Low",
        issuesFound: a.issuesFound || [],
        extractedFields: a, // Store full extraction
        evaluationSource: "gemini-2.5-flash",
      };

      admissionRecord = await AdmissionLetter.create(admissionPayload);

      await Student.findByIdAndUpdate(req.user._id, {
        $push: { admissionLetters: admissionRecord._id },
        $set: {
          "studyPlan.universityName": admissionPayload.universityName,
          "studyPlan.targetCourse": admissionPayload.programName,
        },
      });
    }

    await Student.findByIdAndUpdate(req.user._id, {
      academicRecords: academicRecord._id,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    res.status(200).json({
      success: true,
      message: "Academic Documents Processed Successfully",
      processingTime: `${duration}s`,
      academicVerification: academicRecord.overallVerificationStatus,
      admissionStatus: admissionRecord ? admissionRecord.status : "N/A",
      gapAnalysis: verification?.gapAnalysis || null,
      consistencyIssues: verification?.issues || [],
    });
  } catch (error) {
    console.error("❌ Academic Controller Error:", error);
    await Promise.allSettled(
      allFilePaths.map((p) => deleteLocalFile(p).catch(() => {}))
    );
    return next(
      new AppError(error.message || "Academic Processing Failed", 500)
    );
  }
});

// GET Status
exports.getAcademicStatusV2 = asyncHandler(async (req, res, next) => {
  const records = await AcademicRecords.findOne({ user: req.user._id }).lean();
  const admission = await AdmissionLetter.findOne({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  if (!records && !admission) {
    return res.status(200).json({ success: true, status: "not_started" });
  }

  res.status(200).json({
    success: true,
    academicVerification: records?.overallVerificationStatus || "pending",
    admissionStatus: admission?.status || "N/A",
    records: {
      class10: !!records?.class10,
      class12: !!records?.class12,
      higherEducation: (records?.higherEducation || []).length > 0,
    },
  });
});
