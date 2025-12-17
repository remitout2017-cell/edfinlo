// controllers/workExperienceController.js
const WorkExperience = require("../models/Workexperience");
const {
  extractWorkExperienceInfo,
} = require("../agents/workExperienceExtractionAgent");
const {
  verifyWorkExperienceInfo,
} = require("../agents/workExperienceVerificationAgent");
const {
  compressImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const cache = require("../utils/cache");

// Cleanup helper
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

// Date parser - Fixed to handle various date formats
function parseDate(dateStr) {
  if (!dateStr) return undefined;

  // Handle DD/MM/YYYY or DD-MM-YYYY format
  const ddmmyyyy = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Handle YYYY-MM-DD or YYYY/MM/DD format
  const yyyymmdd = dateStr.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try ISO date parsing
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return undefined;
}

// Calculate months worked - Fixed to handle edge cases
function calculateMonthsWorked(startDate, endDate, currentlyWorking) {
  if (!startDate) return 0;

  const end = currentlyWorking || !endDate ? new Date() : new Date(endDate);
  const start = new Date(startDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return Math.max(0, Math.round(months));
}

// Confidence score converter
function getConfidenceScore(confidence) {
  const map = { high: 0.9, medium: 0.7, low: 0.5 };
  return map[confidence?.toLowerCase()] || 0.5;
}

/**
 * Upload work experience documents
 * Supports: Full-time, Part-time, Internships (paid/unpaid), Freelance, etc.
 */
exports.uploadWorkExperience = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = {};

  try {
    const userId = req.user._id;

    // STEP 0: Validate files
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

    // Experience letter is mandatory
    if (!filePaths.experienceLetter) {
      await cleanupFiles(filePaths);
      throw new AppError("Experience letter is required", 400);
    }

    console.log(`💼 Processing work experience for user ${userId}`);

    // STEP 1: AI Extraction
    let extracted;
    try {
      extracted = await extractWorkExperienceInfo(filePaths, {
        maxRetries: 2,
      });

      if (!extracted.companyName || !extracted.jobTitle) {
        throw new Error("Company name and job title are required");
      }
    } catch (extractError) {
      await cleanupFiles(filePaths);
      throw new AppError(`Extraction failed: ${extractError.message}`, 422);
    }

    // STEP 2: AI Verification
    let verification;
    try {
      verification = await verifyWorkExperienceInfo(extracted, {
        maxRetries: 2,
      });
    } catch (verifyError) {
      console.warn(`⚠️ Verification failed, using fallback`);
      verification = {
        valid: true,
        confidence: "low",
        reason: "Verification service unavailable, manual review required",
      };
    }

    // Optional: Allow low-confidence uploads but flag for review
    if (!verification.valid) {
      await cleanupFiles(filePaths);
      return res.status(422).json({
        success: false,
        error: "Work experience verification failed",
        reason: verification.reason,
        confidence: verification.confidence,
      });
    }

    // STEP 3: Upload to Cloudinary (parallel)
    const urls = {};
    try {
      const uploadPromises = Object.entries(filePaths).map(
        async ([key, fp]) => {
          try {
            const compressedBuffer = await compressImage(fp);
            urls[key] = await uploadImageToCloudinary(
              compressedBuffer,
              `work_experience/${userId}/${key}-${Date.now()}`
            );
            await deleteLocalFile(fp);
            console.log(`✅ Uploaded ${key}`);
          } catch (err) {
            console.error(`❌ Failed to upload ${key}:`, err.message);
            throw err;
          }
        }
      );

      await Promise.all(uploadPromises);
    } catch (uploadError) {
      await cleanupFiles(filePaths);
      throw new AppError(`Upload failed: ${uploadError.message}`, 500);
    }

    // STEP 4: Parse dates and calculate duration
    const startDate = parseDate(extracted.startDate);
    const endDate = parseDate(extracted.endDate);
    const currentlyWorking = Boolean(extracted.currentlyWorking);

    // Validate dates
    if (!startDate) {
      throw new AppError("Valid start date is required", 400);
    }

    if (endDate && startDate && endDate < startDate) {
      throw new AppError("End date cannot be before start date", 400);
    }

    const monthsWorked = calculateMonthsWorked(
      startDate,
      endDate,
      currentlyWorking
    );

    // STEP 5: Process salary slips (if any)
    const salarySlips = [];
    if (
      Array.isArray(extracted.salarySlips) &&
      extracted.salarySlips.length > 0
    ) {
      for (let i = 1; i <= 3; i++) {
        const slipKey = `salarySlip${i}`;
        if (urls[slipKey] && extracted.salarySlips[i - 1]) {
          const slipData = extracted.salarySlips[i - 1];

          // Validate salary slip data
          if (slipData.month && slipData.year) {
            salarySlips.push({
              month: slipData.month,
              year: slipData.year,
              documentUrl: urls[slipKey],
              aiExtractedSalary: slipData.salary || null,
              extractionConfidence: getConfidenceScore(verification.confidence),
              extractedAt: new Date(),
              extractionStatus: "success",
            });
          }
        }
      }
    }

    // STEP 6: Build work experience object
    const workExperienceData = {
      user: userId,
      companyName: extracted.companyName,
      jobTitle: extracted.jobTitle,
      employmentType: extracted.employmentType || "full_time",
      startDate,
      endDate: currentlyWorking ? null : endDate,
      currentlyWorking,
      monthsWorked,
      isPaid: extracted.isPaid !== false, // Default true
      stipendAmount: extracted.stipendAmount || null,
      experienceLetterUrl: urls.experienceLetter,
      offerLetterUrl: urls.offerLetter || null,
      joiningLetterUrl: urls.joiningLetter || null,
      employeeIdCardUrl: urls.employeeIdCard || null,
      salarySlips,
      verified: verification.valid && verification.confidence === "high",
      verificationNotes: verification.reason || "AI verification completed",
      verificationConfidence: getConfidenceScore(verification.confidence),
      extractionStatus: "success",
      extractedAt: new Date(),
    };

    const userId2 = req.user._id;

    // 🔍 Delete existing work experience for this user
    const existingExperience = await WorkExperience.findOne({ user: userId2 });

    if (existingExperience) {
      console.log("⚠️ Existing work experience found. Deleting...");
      await WorkExperience.deleteMany({ user: userId2 });
      console.log("✅ Old work experience deleted");
    }

    // STEP 7: Save to database
    const workExperience = await WorkExperience.create(workExperienceData);

    const duration = Date.now() - startTime;
    console.log(`✅ Work experience pipeline completed in ${duration}ms`);

    return res.status(201).json({
      success: true,
      message: "Work experience uploaded successfully",
      data: {
        workExperienceId: workExperience._id,
        companyName: workExperience.companyName,
        jobTitle: workExperience.jobTitle,
        employmentType: workExperience.employmentType,
        isPaid: workExperience.isPaid,
        startDate: workExperience.startDate,
        endDate: workExperience.endDate,
        currentlyWorking: workExperience.currentlyWorking,
        monthsWorked: workExperience.monthsWorked,
        experienceYears: workExperience.experienceYears,
        verified: workExperience.verified,
        verificationConfidence: verification.confidence,
        uploadedDocuments: {
          experienceLetter: true,
          offerLetter: !!urls.offerLetter,
          joiningLetter: !!urls.joiningLetter,
          employeeIdCard: !!urls.employeeIdCard,
          salarySlips: salarySlips.length,
        },
        processingTime: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error("❌ Work experience upload error:", error.message);
    await cleanupFiles(filePaths);
    next(error);
  }
});

/**
 * Get all work experience for user
 */
exports.getWorkExperience = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const cacheKey = `workexp:list:${userId}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        fromCache: true,
      });
    }
    const workExperiences = await WorkExperience.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total experience
    const totalMonths = workExperiences.reduce(
      (sum, exp) => sum + (exp.monthsWorked || 0),
      0
    );
    const totalYears = Math.round((totalMonths / 12) * 100) / 100;

    await cache.set(cacheKey, {
      experiences: workExperiences,
      totalMonths,
      totalYears,
      count: workExperiences.length,
    });

    return res.status(200).json({
      success: true,
      data: {
        experiences: workExperiences,
        totalMonths,
        totalYears,
        count: workExperiences.length,
      },
    });
  } catch (error) {
    console.error("❌ Get work experience error:", error.message);
    next(error);
  }
});

/**
 * Delete work experience entry
 */
exports.deleteWorkExperience = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { experienceId } = req.params;

    if (!experienceId) {
      throw new AppError("Experience ID is required", 400);
    }

    const workExperience = await WorkExperience.findOneAndDelete({
      _id: experienceId,
      user: userId,
    });

    if (!workExperience) {
      throw new AppError("Work experience not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Work experience deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete work experience error:", error.message);
    next(error);
  }
});
