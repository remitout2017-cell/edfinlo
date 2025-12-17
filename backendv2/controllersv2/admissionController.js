// controllers/admissionController.js
const AdmissionLetter = require("../models/AdmissionLetter");
const Student = require("../models/students");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const { compressImage, uploadImageToCloudinary, deleteLocalFile } = require("../services/imageService");

// NEW: Use AdmissionLetterAgent directly
const { AdmissionLetterAgent } = require("../ai/agents/documents/AdmissionLetterAgent");

const admissionAgent = new AdmissionLetterAgent();

/**
 * Upload admission letter using new agent
 */
exports.uploadAdmissionLetter = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePath = null;

  try {
    const user = req.user;

    if (!req.file) {
      throw new AppError("Admission letter file is required", 400);
    }

    filePath = req.file.path;
    const isPdf = req.file.mimetype.toLowerCase().includes("pdf");

    // Upload to Cloudinary first
    let cloudUrl;
    if (isPdf) {
      const buffer = await fs.promises.readFile(filePath);
      cloudUrl = await uploadPdfToCloudinary(buffer, `admission_letters/${user._id}-${Date.now()}`);
    } else {
      const compressedBuffer = await compressImage(filePath);
      cloudUrl = await uploadImageToCloudinary(compressedBuffer, `admission_letters/${user._id}-${Date.now()}`);
    }
    await deleteLocalFile(filePath);

    // Convert to base64 for agent
    const buffer = await fs.promises.readFile(filePath);
    const images = [{
      base64: buffer.toString('base64'),
      mimeType: isPdf ? 'application/pdf' : 'image/jpeg'
    }];

    // Process with NEW agent
    const result = await admissionAgent.processAdmissionLetter(images);

    if (!result.success || !result.admissionData) {
      return res.status(422).json({
        success: false,
        error: "Admission letter processing failed",
        details: result,
      });
    }

    // Save to database
    const admissionLetter = await AdmissionLetter.create({
      user: user._id,
      status: "verified",
      admissionLetterUrl: cloudUrl,
      universityName: result.admissionData.universityName,
      programName: result.admissionData.programName,
      intakeTerm: result.admissionData.intakeTerm,
      intakeYear: result.admissionData.intakeYear,
      country: result.admissionData.country,
      evaluationSource: "langgraph_agent_v2",
      extractedFields: result.admissionData,
    });

    await Student.findByIdAndUpdate(user._id, {
      Admissionletter: admissionLetter._id,
    });

    const duration = Date.now() - startTime;

    res.status(201).json({
      success: true,
      message: "Admission letter processed successfully",
      data: {
        id: admissionLetter._id,
        admissionData: result.admissionData,
        processingTime: `${duration}ms`,
        workflow: "LangGraph Admission Agent v2",
      },
    });
  } catch (error) {
    console.error("❌ Admission letter error:", error);
    if (filePath) await deleteLocalFile(filePath).catch(() => {});
    next(error);
  }
});
