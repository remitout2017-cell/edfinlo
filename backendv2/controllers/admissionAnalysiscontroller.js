// controllers/admissionAnalysiscontroller.js

const fs = require("fs").promises;
const AdmissionLetter = require("../models/AdmissionLetter");
const Student = require("../models/students");
const {
  compressImage,
  uploadImageToCloudinary,
  deleteLocalFile,
  uploadPdfToCloudinary,
} = require("../services/imageService");
const { AppError } = require("../middlewares/errorMiddleware");
const { analyzeAdmissionLetter } = require("../oldagents/AdmissionletterExtractor");
const cache = require("../utils/cache");

exports.analyzeAdmissionLetterController = async (req, res, next) => {
  const user = req.user;
  const cacheKey = `admission:v2:${user._id}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      data: cached,
      fromCache: true,
    });
  }

  if (!user) return next(new AppError("Authentication required", 401));
  if (!req.file) return next(new AppError("Admission letter file is required", 400));

  const filePath = req.file.path;
  const isPdf = req.file.mimetype.toLowerCase().includes("pdf");

  let cloudUrl;

  try {
    // 1) Check and DELETE existing admission letter if present
    console.log("🔍 Checking for existing admission letter...");
    const existingAdmissionLetter = await AdmissionLetter.findOne({ user: user._id });
    
    if (existingAdmissionLetter) {
      console.log("⚠️ Existing admission letter found. Deleting...");
      await AdmissionLetter.findByIdAndDelete(existingAdmissionLetter._id);
      
      // Also remove reference from Student model
      await Student.findByIdAndUpdate(user._id, {
        $unset: { Admissionletter: 1 }
      });
      
      console.log("✅ Old admission letter deleted successfully");
    } else {
      console.log("✅ No existing admission letter found");
    }

    // 2) Upload to Cloudinary
    console.log("📤 Uploading admission letter to Cloudinary...");
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

    await deleteLocalFile(filePath).catch(() => { });
    console.log("✅ Uploaded:", cloudUrl);

    // 2) Run AI analysis on Cloudinary URL
    console.log("🤖 Starting AI analysis from Cloudinary URL...");
    const analysis = await analyzeAdmissionLetter({
      cloudinaryUrl: cloudUrl,
      fileType: isPdf ? "pdf" : "image",
    });

    // 3) Create NEW AdmissionLetter entry
    const admissionLetter = await AdmissionLetter.create({
      user: user._id,
      admissionLetterUrl: cloudUrl,
      universityName: analysis.universityName,
      programName: analysis.programName,
      intakeTerm: analysis.intakeTerm,
      intakeYear: analysis.intakeYear,
      country: analysis.country,
      universityScore: analysis.universityScore,
      riskLevel: analysis.riskLevel,
      issuesFound: analysis.issuesFound,
      evaluationSource: "gemini_plus_groq",
      geminiSummary: analysis.geminiSummary,
      groqSummary: analysis.groqSummary,
      extractedFields: analysis.extractedFields,
    });

    await Student.findByIdAndUpdate(user._id, {
      Admissionletter: admissionLetter._id,
    });

    // 🔧 FIX: Create response data object for caching
    const responseData = {
      id: admissionLetter._id,
      admissionLetterUrl: admissionLetter.admissionLetterUrl,
      universityName: admissionLetter.universityName,
      programName: admissionLetter.programName,
      intakeTerm: admissionLetter.intakeTerm,
      intakeYear: admissionLetter.intakeYear,
      country: admissionLetter.country,
      universityScore: admissionLetter.universityScore,
      riskLevel: admissionLetter.riskLevel,
      issuesFound: admissionLetter.issuesFound,
      geminiSummary: admissionLetter.geminiSummary,
      groqSummary: admissionLetter.groqSummary,
      evaluatedAt: admissionLetter.evaluatedAt,
    };

    // 🔧 FIX: Cache the correct data object
    await cache.set(cacheKey, responseData, 120);

    return res.status(201).json({
      success: true,
      message: "Admission letter analyzed successfully",
      data: responseData,
    });
  } catch (err) {
    console.error("❌ Error in analyzeAdmissionLetterController:", err);
    await deleteLocalFile(filePath).catch(() => { });
    next(err);
  }
};