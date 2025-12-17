// controllersv2/workExperienceControllerV2.js

const WorkExperienceAgent =
  require("../ai/agents/documents/WorkExperienceAgent").WorkExperienceAgent;
const Student = require("../models/students");
const Workexperience = require("../models/Workexperience");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const {
  compressAndEncryptImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");

// ============================================================================
// 🚀 UPLOAD & PROCESS WORK EXPERIENCE
// ============================================================================
exports.uploadWorkExperienceV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = [];

  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError("No work experience documents uploaded", 400);
    }

    filePaths = req.files.map((f) => f.path);
    console.log(`💼 Processing Work Experience for user ${req.user._id}`);

    // 1. Extract documents using AI
    const agent = new WorkExperienceAgent();
    const documents = req.files.map((f) => f.path);

    console.log("📄 Processing work experience documents...");

    let result;
    try {
      result = await agent.processWorkExperience(documents);
    } catch (agentError) {
      console.error("⚠️ Agent workflow error:", agentError.message);
      throw new AppError(
        "Work experience extraction failed: " + agentError.message,
        500
      );
    }

    if (
      !result ||
      !result.workExperiences ||
      result.workExperiences.length === 0
    ) {
      throw new Error("No work experience data extracted");
    }

    const { workExperiences, verification = {} } = result;

    // 2. Upload to Cloudinary
    console.log("☁️ Uploading encrypted documents...");
    const uploadedUrls = [];

    for (const file of req.files) {
      const encryptedBuffer = await compressAndEncryptImage(file.path);
      const url = await uploadImageToCloudinary(
        encryptedBuffer,
        `work_experience/${req.user.id}/${Date.now()}.jpg`
      );
      uploadedUrls.push(url);
      await deleteLocalFile(file.path);
    }

    // 3. Save to Database (ONE document per experience)
    console.log("💾 Saving work experiences to database...");

    // Delete existing work experiences for this user
    await Workexperience.deleteMany({ user: req.user._id });

    const savedExperiences = [];

    for (let i = 0; i < workExperiences.length; i++) {
      const exp = workExperiences[i];

      const workExpDoc = new Workexperience({
        user: req.user._id, // ✅ CORRECT FIELD NAME
        companyName: exp.companyName || "Unknown Company",
        jobTitle: exp.primaryDesignation || exp.designation || "Not specified",
        employmentType: mapEmploymentType(exp.employmentType),
        startDate: parseDate(exp.startDate),
        endDate: exp.endDate ? parseDate(exp.endDate) : null,
        currentlyWorking: exp.currentlyWorking || false,
        isPaid: exp.isPaid !== false,
        stipendAmount: exp.salary?.amount || null,
        experienceLetterUrl: uploadedUrls[i] || uploadedUrls[0], // ✅ REQUIRED FIELD
        verified: verification?.verified || false,
        verificationConfidence: (verification?.confidence || 50) / 100,
        extractedData: exp,
        extractionStatus: "success",
        extractedAt: new Date(),
      });

      // Calculate months worked
      workExpDoc.calculateMonthsWorked();

      const saved = await workExpDoc.save();
      savedExperiences.push(saved);
    }

    // 4. Link to Student
    await Student.findByIdAndUpdate(req.user._id, {
      workExperience: savedExperiences[0]?._id, // Link to first experience
    });

    // Calculate total experience
    const totalMonths = savedExperiences.reduce(
      (sum, exp) => sum + (exp.monthsWorked || 0),
      0
    );
    const totalYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    const totalExperience =
      totalYears > 0
        ? `${totalYears} year${totalYears > 1 ? "s" : ""} ${
            remainingMonths > 0
              ? `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
              : ""
          }`.trim()
        : `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.status(200).json({
      success: true,
      message: "Work Experience Processed Successfully",
      processingTime: `${duration}s`,
      totalExperience,
      experienceCount: savedExperiences.length,
      verified: verification?.verified || false,
    });
  } catch (error) {
    console.error("❌ Work Experience Error:", error);
    await Promise.allSettled(
      filePaths.map((p) => deleteLocalFile(p).catch(() => {}))
    );
    return next(
      new AppError(error.message || "Work Experience Processing Failed", 500)
    );
  }
});

// ============================================================================
// 📥 GET WORK EXPERIENCE
// ============================================================================
exports.getWorkExperienceV2 = asyncHandler(async (req, res, next) => {
  const workExps = await Workexperience.find({ user: req.user._id })
    .select("-extractedData -experienceLetterUrl")
    .sort({ startDate: -1 })
    .lean();

  if (!workExps || workExps.length === 0) {
    return res.status(200).json({
      success: true,
      status: "not_started",
      message: "No work experience data found",
    });
  }

  const totalMonths = workExps.reduce(
    (sum, exp) => sum + (exp.monthsWorked || 0),
    0
  );
  const totalYears = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  res.status(200).json({
    success: true,
    data: {
      totalExperience:
        totalYears > 0
          ? `${totalYears} year${totalYears > 1 ? "s" : ""} ${
              remainingMonths > 0
                ? `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
                : ""
            }`.trim()
          : `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`,
      experienceCount: workExps.length,
      experiences: workExps.map((exp) => ({
        companyName: exp.companyName,
        jobTitle: exp.jobTitle,
        employmentType: exp.employmentType,
        startDate: exp.startDate,
        endDate: exp.endDate,
        currentlyWorking: exp.currentlyWorking,
        monthsWorked: exp.monthsWorked,
        verified: exp.verified,
      })),
    },
  });
});

// ============================================================================
// 🗑️ DELETE WORK EXPERIENCE
// ============================================================================
exports.deleteWorkExperienceV2 = asyncHandler(async (req, res, next) => {
  const result = await Workexperience.deleteMany({ user: req.user._id });

  if (result.deletedCount === 0) {
    return res.status(404).json({
      success: false,
      message: "No work experience found",
    });
  }

  await Student.findByIdAndUpdate(req.user._id, {
    $unset: { workExperience: 1 },
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} work experience record(s) deleted successfully`,
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDate(dateStr) {
  if (
    !dateStr ||
    dateStr.toLowerCase() === "present" ||
    dateStr.toLowerCase() === "current"
  ) {
    return null;
  }

  // Try DD/MM/YYYY format
  const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (parts) {
    const [, day, month, year] = parts;
    return new Date(year, month - 1, day);
  }

  // Try ISO or other formats
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function mapEmploymentType(type) {
  const typeMap = {
    full_time: "full_time",
    part_time: "part_time",
    internship: "internship_paid",
    contract: "contract",
    freelance: "freelance",
    volunteer: "volunteer",
    self_employed: "self_employed",
  };

  return typeMap[type?.toLowerCase()] || "full_time";
}
