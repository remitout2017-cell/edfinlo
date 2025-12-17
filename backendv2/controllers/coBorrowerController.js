// controllers/coBorrowerController.js - COMPLETE WORKING VERSION

const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const CoBorrower = require("../models/CoBorrower");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const config = require("../config/config");

// Import agents
const kycAgent = require("../agents/coborrower/kycagent");
const salarySlipAgent = require("../agents/coborrower/salarySlipAgent");
const itrAgent = require("../agents/coborrower/itrAgent");
const form16Agent = require("../agents/coborrower/form16Agent");
const bankStatementAgent = require("../agents/coborrower/bankStatementAgent");

// Import services
const imageService = require("../services/imageService");

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Encrypt sensitive text (Aadhaar, PAN numbers)
 */
function encryptText(text) {
  if (!text) return null;
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
    return null;
  }
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const ddMMyyyy = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddMMyyyy) {
    const [, day, month, year] = ddMMyyyy;
    return new Date(year, month - 1, day);
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Clean up temporary files
 */
async function cleanupFiles(filePaths) {
  if (!filePaths || filePaths.length === 0) return;
  const cleanupPromises = filePaths.map(async (filePath) => {
    if (!filePath || typeof filePath !== "string") return;
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Cleaned up: ${filePath}`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`⚠️ Failed to cleanup ${filePath}:`, error.message);
      }
    }
  });
  await Promise.allSettled(cleanupPromises);
}

/**
 * Process and convert images to base64 for AI agents
 */
async function processAndConvertImages(filePaths) {
  const images = [];
  for (const filePath of filePaths) {
    try {
      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString("base64");
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      images.push(`data:${mimeType};base64,${base64}`);
    } catch (error) {
      console.warn(`⚠️ Failed to process image ${filePath}:`, error.message);
    }
  }
  return images;
}

/**
 * Upload image to Cloudinary - Adapter for imageService
 */
async function uploadToCloudinary(
  filePath,
  category,
  userId,
  coBorrowerId,
  label
) {
  try {
    const safeCategory = (category || "doc").toString();
    const safeUserId = (userId || "user").toString().slice(0, 24);
    const safeCoBorrowerId = (coBorrowerId || "cb").toString().slice(0, 24);
    const safeLabel = (label || "file")
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const filename = `${safeCategory}/${safeUserId}/${safeCoBorrowerId}/${safeLabel}_${Date.now()}`;

    // Use imageService.uploadToCloudinary
    const url = await imageService.uploadToCloudinary(filePath, filename);

    return { url, filename };
  } catch (error) {
    console.error(
      `❌ Cloudinary upload failed for ${filePath}:`,
      error.message
    );
    throw new AppError(`Failed to upload ${label}: ${error.message}`, 500);
  }
}

// ============================================================================
// 1. CREATE CO-BORROWER WITH ALL CORE DOCUMENTS
// ============================================================================

exports.createCoBorrower = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Debug logs
  console.log("=== CREATE CO-BORROWER WITH DOCUMENTS ===");
  console.log("📝 Body keys:", Object.keys(req.body || {}));
  console.log("📁 Files:", req.files ? Object.keys(req.files) : "No files");

  if (!req.body) {
    throw new AppError(
      "Request body is missing. Make sure Content-Type is set correctly.",
      400
    );
  }

  // Extract and validate basic info
  const relationToStudent = req.body.relationToStudent?.trim();
  const firstName = req.body.firstName?.trim();
  const lastName = req.body.lastName?.trim() || "";

  if (!relationToStudent || !firstName) {
    throw new AppError("Relation to student and first name are required", 400);
  }

  // Validate relation
  const validRelations = [
    "father",
    "mother",
    "brother",
    "sister",
    "spouse",
    "uncle",
    "aunt",
    "grandfather",
    "grandmother",
    "guardian",
  ];
  if (!validRelations.includes(relationToStudent)) {
    throw new AppError(
      `Invalid relation. Must be one of: ${validRelations.join(", ")}`,
      400
    );
  }

  if (!req.files || Object.keys(req.files).length === 0) {
    throw new AppError("No documents uploaded", 400);
  }

  // Get all file paths
  const allFiles = [];
  const fileGroups = {
    aadhaarFront: req.files.aadhaarFront?.map((f) => f.path) || [],
    aadhaarBack: req.files.aadhaarBack?.map((f) => f.path) || [],
    panFront: req.files.panFront?.map((f) => f.path) || [],
    panBack: req.files.panBack?.map((f) => f.path) || [],
    salarySlip1: req.files.salarySlip1?.map((f) => f.path) || [],
    salarySlip2: req.files.salarySlip2?.map((f) => f.path) || [],
    salarySlip3: req.files.salarySlip3?.map((f) => f.path) || [],
    itr2024: req.files.itr2024?.map((f) => f.path) || [],
    itr2023: req.files.itr2023?.map((f) => f.path) || [],
    form162024: req.files.form162024?.map((f) => f.path) || [],
    form162023: req.files.form162023?.map((f) => f.path) || [],
  };

  Object.values(fileGroups).forEach((group) => allFiles.push(...group));

  console.log("📊 File counts:", {
    aadhaarFront: fileGroups.aadhaarFront.length,
    aadhaarBack: fileGroups.aadhaarBack.length,
    panFront: fileGroups.panFront.length,
    salarySlips:
      fileGroups.salarySlip1.length +
      fileGroups.salarySlip2.length +
      fileGroups.salarySlip3.length,
    itr: fileGroups.itr2024.length + fileGroups.itr2023.length,
    form16: fileGroups.form162024.length + fileGroups.form162023.length,
  });

  // Validate required documents (Form 16 is OPTIONAL)
  if (
    fileGroups.aadhaarFront.length === 0 ||
    fileGroups.aadhaarBack.length === 0 ||
    fileGroups.panFront.length === 0
  ) {
    await cleanupFiles(allFiles);
    throw new AppError(
      "Aadhaar (front & back) and PAN (front) are required",
      400
    );
  }

  if (
    fileGroups.salarySlip1.length === 0 ||
    fileGroups.salarySlip2.length === 0 ||
    fileGroups.salarySlip3.length === 0
  ) {
    await cleanupFiles(allFiles);
    throw new AppError("All 3 months of salary slips are required", 400);
  }

  if (fileGroups.itr2024.length === 0 || fileGroups.itr2023.length === 0) {
    await cleanupFiles(allFiles);
    throw new AppError("ITR for 2024 and 2023 are required", 400);
  }

  let coBorrower = null;

  try {
    console.log("🚀 Starting document processing...");

    // Step 1: Create co-borrower record
    coBorrower = await CoBorrower.create({
      student: userId,
      relationToStudent,
      firstName,
      lastName,
    });

    const coBorrowerId = coBorrower._id;
    console.log("✅ Co-borrower created:", coBorrowerId);

    // ========================================================================
    // Step 2: Process KYC Documents
    // ========================================================================
    console.log("📄 Processing KYC documents...");

    const aadhaarFrontImages = await processAndConvertImages(
      fileGroups.aadhaarFront
    );
    const aadhaarBackImages = await processAndConvertImages(
      fileGroups.aadhaarBack
    );
    const panFrontImages = await processAndConvertImages(fileGroups.panFront);
    const panBackImages = await processAndConvertImages(fileGroups.panBack);

    const aadhaarData = await kycAgent.extractAadhaar([
      ...aadhaarFrontImages,
      ...aadhaarBackImages,
    ]);

    const panData = await kycAgent.extractPAN([
      ...panFrontImages,
      ...panBackImages,
    ]);

    const verification = await kycAgent.verifyKYC(aadhaarData, panData);

    if (!verification.verified || verification.confidence < 0.6) {
      throw new AppError(
        `KYC verification failed: ${
          verification.issues?.join(", ") || "Low confidence"
        }`,
        422
      );
    }

    console.log("✅ KYC verified");

    // Upload KYC to Cloudinary
    console.log("☁️ Uploading KYC documents...");
    const kycUrls = {
      aadhaarFrontUrls: [],
      aadhaarBackUrls: [],
      panFrontUrls: [],
      panBackUrls: [],
    };

    for (const filePath of fileGroups.aadhaarFront) {
      const result = await uploadToCloudinary(
        filePath,
        "kyc",
        userId,
        coBorrowerId,
        "aadhaar_front"
      );
      kycUrls.aadhaarFrontUrls.push(result.url);
    }

    for (const filePath of fileGroups.aadhaarBack) {
      const result = await uploadToCloudinary(
        filePath,
        "kyc",
        userId,
        coBorrowerId,
        "aadhaar_back"
      );
      kycUrls.aadhaarBackUrls.push(result.url);
    }

    for (const filePath of fileGroups.panFront) {
      const result = await uploadToCloudinary(
        filePath,
        "kyc",
        userId,
        coBorrowerId,
        "pan_front"
      );
      kycUrls.panFrontUrls.push(result.url);
    }

    if (fileGroups.panBack.length > 0) {
      for (const filePath of fileGroups.panBack) {
        const result = await uploadToCloudinary(
          filePath,
          "kyc",
          userId,
          coBorrowerId,
          "pan_back"
        );
        kycUrls.panBackUrls.push(result.url);
      }
    }

    coBorrower.kycData = {
      ...kycUrls,
      aadhaarNumber: encryptText(aadhaarData.aadhaarNumber),
      panNumber: encryptText(panData.panNumber),
      aadhaarName: aadhaarData.name,
      aadhaarDOB: parseDate(aadhaarData.dob),
      aadhaarGender: aadhaarData.gender,
      aadhaarAddress: aadhaarData.address,
      panName: panData.name,
      panFatherName: panData.fatherName,
      panDOB: parseDate(panData.dob),
      verificationConfidence: verification.confidence,
      verificationDetails: verification,
      lastVerifiedAt: new Date(),
    };

    coBorrower.kycStatus = "verified";
    coBorrower.kycVerifiedAt = new Date();

    // ========================================================================
    // Step 3: Process Salary Slips
    // ========================================================================
    console.log("💰 Processing salary slips...");

    const salaryImages = {
      0: await processAndConvertImages(fileGroups.salarySlip1),
      1: await processAndConvertImages(fileGroups.salarySlip2),
      2: await processAndConvertImages(fileGroups.salarySlip3),
    };

    const salaryData = await salarySlipAgent.extractSalaryDetails(salaryImages);
    const validSalaries = salaryData.filter((s) => s.confidence > 0.5);

    if (validSalaries.length < 2) {
      throw new AppError(
        "Could not extract sufficient salary information",
        422
      );
    }

    // Upload salary slips
    const uploadedSalarySlips = [];
    const salaryMonths = [
      { files: fileGroups.salarySlip1, data: salaryData[0] },
      { files: fileGroups.salarySlip2, data: salaryData[1] },
      { files: fileGroups.salarySlip3, data: salaryData[2] },
    ];

    for (let i = 0; i < salaryMonths.length; i++) {
      const { files, data } = salaryMonths[i];
      const documentUrls = [];

      for (const filePath of files) {
        const result = await uploadToCloudinary(
          filePath,
          "financial",
          userId,
          coBorrowerId,
          `salary_slip_month${i + 1}`
        );
        documentUrls.push(result.url);
      }

      uploadedSalarySlips.push({
        ...data,
        documentUrls,
        uploadDate: new Date(),
      });
    }

    coBorrower.financialInfo = coBorrower.financialInfo || {};
    coBorrower.financialInfo.salarySlips = uploadedSalarySlips;

    const avgNetSalary =
      uploadedSalarySlips.reduce(
        (sum, slip) => sum + (slip.netSalary || 0),
        0
      ) / uploadedSalarySlips.length;

    console.log("✅ Salary slips processed");

    // ========================================================================
    // Step 4: Process ITR Documents
    // ========================================================================
    console.log("📋 Processing ITR documents...");

    const itrImages = {
      2024: await processAndConvertImages(fileGroups.itr2024),
      2023: await processAndConvertImages(fileGroups.itr2023),
    };

    const itrData = await itrAgent.extractITRDetails(itrImages);
    const validITRs = itrData.filter((itr) => itr.confidence > 0.5);

    if (validITRs.length < 2) {
      throw new AppError("Could not extract sufficient ITR information", 422);
    }

    // Upload ITR documents
    const uploadedITRs = [];
    const itrYears = [
      {
        year: "2024",
        files: fileGroups.itr2024,
        data: itrData.find((d) => d.year === "2024") || itrData[0],
      },
      {
        year: "2023",
        files: fileGroups.itr2023,
        data: itrData.find((d) => d.year === "2023") || itrData[1],
      },
    ];

    for (const { year, files, data } of itrYears) {
      const documentUrls = [];

      for (const filePath of files) {
        const result = await uploadToCloudinary(
          filePath,
          "financial",
          userId,
          coBorrowerId,
          `itr_${year}`
        );
        documentUrls.push(result.url);
      }

      uploadedITRs.push({
        ...data,
        documentUrls,
        uploadedAt: new Date(),
      });
    }

    coBorrower.financialInfo.itrData = uploadedITRs;
    console.log("✅ ITR processed");

    // ========================================================================
    // Step 5: Process Form 16 Documents (OPTIONAL)
    // ========================================================================
    let uploadedForm16s = [];
    const hasForm16 =
      fileGroups.form162024.length > 0 || fileGroups.form162023.length > 0;

    if (hasForm16) {
      console.log("📄 Processing Form 16 documents (optional)...");

      if (
        fileGroups.form162024.length > 0 &&
        fileGroups.form162023.length === 0
      ) {
        console.warn(
          "⚠️ Form 16 2024 provided but 2023 missing - skipping Form 16 processing"
        );
      } else if (
        fileGroups.form162023.length > 0 &&
        fileGroups.form162024.length === 0
      ) {
        console.warn(
          "⚠️ Form 16 2023 provided but 2024 missing - skipping Form 16 processing"
        );
      } else {
        try {
          const form16Images = {
            2024: await processAndConvertImages(fileGroups.form162024),
            2023: await processAndConvertImages(fileGroups.form162023),
          };

          const form16Data = await form16Agent.extractForm16Details(
            form16Images
          );
          const validForm16s = form16Data.filter((f) => f.confidence > 0.5);

          if (validForm16s.length >= 1) {
            const form16Years = [
              {
                year: "2024",
                files: fileGroups.form162024,
                data:
                  form16Data.find((d) => d.year === "2024") || form16Data[0],
              },
              {
                year: "2023",
                files: fileGroups.form162023,
                data:
                  form16Data.find((d) => d.year === "2023") || form16Data[1],
              },
            ];

            for (const { year, files, data } of form16Years) {
              if (files.length > 0) {
                const documentUrls = [];

                for (const filePath of files) {
                  const result = await uploadToCloudinary(
                    filePath,
                    "financial",
                    userId,
                    coBorrowerId,
                    `form16_${year}`
                  );
                  documentUrls.push(result.url);
                }

                uploadedForm16s.push({
                  ...data,
                  documentUrls,
                  uploadedAt: new Date(),
                });
              }
            }

            coBorrower.financialInfo.form16Data = uploadedForm16s;
            console.log("✅ Form 16 processed");
          } else {
            console.warn("⚠️ Form 16 extraction confidence too low - skipping");
          }
        } catch (form16Error) {
          console.error(
            "⚠️ Form 16 processing failed (non-critical):",
            form16Error.message
          );
        }
      }
    } else {
      console.log("ℹ️ No Form 16 documents provided (optional)");
    }

    // ========================================================================
    // Calculate Financial Summary
    // ========================================================================
    const avgAnnualIncome =
      uploadedITRs.reduce((sum, itr) => sum + (itr.taxableIncome || 0), 0) /
      uploadedITRs.length;

    coBorrower.financialInfo.financialSummary = {
      avgMonthlySalary: avgNetSalary,
      avgMonthlyIncome: avgNetSalary,
      estimatedAnnualIncome: avgAnnualIncome,
      incomeSource: "salaried",
      incomeStability: uploadedSalarySlips.every((s) => s.isConsistent)
        ? "stable"
        : "moderate",
      itrYearsCovered: uploadedITRs.length,
      form16YearsCovered: uploadedForm16s.length,
      salarySlipCount: uploadedSalarySlips.length,
      lastUpdated: new Date(),
    };

    // Mark as verified
    coBorrower.financialVerificationStatus = "verified";
    coBorrower.financialVerifiedAt = new Date();

    await coBorrower.save();

    // Cleanup temp files
    await cleanupFiles(allFiles);

    console.log("✅ Co-borrower fully processed!");

    res.status(201).json({
      success: true,
      message:
        uploadedForm16s.length > 0
          ? "Co-borrower added and all documents verified successfully"
          : "Co-borrower added successfully (Form 16 not provided)",
      data: {
        coBorrowerId: coBorrower._id,
        firstName: coBorrower.firstName,
        lastName: coBorrower.lastName,
        relationToStudent: coBorrower.relationToStudent,
        kycStatus: coBorrower.kycStatus,
        financialVerificationStatus: coBorrower.financialVerificationStatus,
        avgMonthlySalary: Math.round(avgNetSalary),
        itrYears: uploadedITRs.length,
        form16Years: uploadedForm16s.length,
        hasForm16: uploadedForm16s.length > 0,
      },
    });
  } catch (error) {
    console.error("❌ Error processing co-borrower:", error.message);

    // Cleanup files
    await cleanupFiles(allFiles);

    // Delete co-borrower if it was created
    if (coBorrower && coBorrower._id) {
      await CoBorrower.findByIdAndDelete(coBorrower._id).catch((err) =>
        console.error("Failed to cleanup co-borrower:", err)
      );
    }

    throw error;
  }
});

// ============================================================================
// 2. UPLOAD BANK STATEMENTS (Separate endpoint)
// ============================================================================

exports.uploadBankStatements = asyncHandler(async (req, res) => {
  const { coBorrowerId } = req.params;
  const userId = req.user._id;

  if (!req.files || req.files.length === 0) {
    throw new AppError("No bank statement images uploaded", 400);
  }

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: userId,
  });

  if (!coBorrower) {
    await cleanupFiles(req.files.map((f) => f.path));
    throw new AppError("Co-borrower not found", 404);
  }

  const statementFiles = req.files.map((f) => f.path);

  if (statementFiles.length < 5) {
    await cleanupFiles(statementFiles);
    throw new AppError("Minimum 5 bank statement pages required", 400);
  }

  try {
    console.log("📄 Converting bank statement images...");
    const statementImages = await processAndConvertImages(statementFiles);

    console.log("🏦 Analyzing bank statement...");
    const bankData = await bankStatementAgent.extractBankStatement(
      statementImages
    );

    if (!bankData || bankData.confidence < 0.5) {
      throw new AppError(
        "Could not extract sufficient bank statement information",
        422
      );
    }

    const monthsDetected = bankData.monthlyAnalysis?.length || 0;
    const avgBalance = bankData.overallAnalysis?.averageMonthlyBalance || 0;

    if (monthsDetected < 4) {
      throw new AppError(
        `Only ${monthsDetected} months detected. Minimum 4 months required.`,
        422
      );
    }

    console.log("☁️ Uploading bank statements...");
    const documentUrls = [];

    for (let i = 0; i < statementFiles.length; i++) {
      const result = await uploadToCloudinary(
        statementFiles[i],
        "financial",
        userId,
        coBorrowerId,
        `bank_statement_page_${i + 1}`
      );
      documentUrls.push(result.url);
    }

    coBorrower.financialInfo = coBorrower.financialInfo || {};
    coBorrower.financialInfo.bankStatement = {
      status: "verified",
      accountDetails: {
        accountNumber: bankData.accountDetails?.accountNumber,
        bankName: bankData.accountDetails?.bankName,
        ifscCode: bankData.accountDetails?.ifscCode,
        accountType: bankData.accountDetails?.accountType || "Savings",
        accountHolderName: bankData.accountDetails?.accountHolderName,
        branch: bankData.accountDetails?.branch,
      },
      statementPeriod: bankData.accountDetails?.statementPeriod || {
        from: null,
        to: null,
      },
      monthlyAnalysis: bankData.monthlyAnalysis || [],
      overallAnalysis: bankData.overallAnalysis || {},
      enhancedAnalysis: bankData.enhancedAnalysis || {},
      documentUrls,
      pageCount: documentUrls.length,
      extractedAt: new Date(),
    };

    const existingEmi =
      bankData.overallAnalysis?.emiObligations?.totalMonthlyEMI || 0;
    const currentIncome =
      coBorrower.financialInfo.financialSummary?.avgMonthlyIncome || 0;
    const bankIncome =
      bankData.overallAnalysis?.salaryConsistency?.averageAmount || 0;
    const verifiedIncome = Math.max(currentIncome, bankIncome);

    coBorrower.financialInfo.financialSummary = {
      ...coBorrower.financialInfo.financialSummary,
      avgMonthlyIncome: verifiedIncome,
      totalExistingEmi: existingEmi,
      foir: verifiedIncome > 0 ? (existingEmi / verifiedIncome) * 100 : 0,
      lastUpdated: new Date(),
    };

    coBorrower.bankStatementStatus = "verified";
    await coBorrower.save();

    await cleanupFiles(statementFiles);

    res.status(200).json({
      success: true,
      message: "Bank statements processed successfully",
      data: {
        coBorrowerId: coBorrower._id,
        monthsAnalyzed: monthsDetected,
        averageMonthlyBalance: Math.round(avgBalance),
        totalEMI: existingEmi,
      },
    });
  } catch (error) {
    await cleanupFiles(statementFiles);

    coBorrower.financialInfo = coBorrower.financialInfo || {};
    coBorrower.financialInfo.bankStatement = {
      status: "failed",
      failureReason: error.message,
      failedAt: new Date(),
    };
    coBorrower.bankStatementStatus = "failed";
    await coBorrower.save();

    throw error;
  }
});

// ============================================================================
// 3. GET ALL CO-BORROWERS
// ============================================================================

exports.getCoBorrowers = asyncHandler(async (req, res) => {
  const coBorrowers = await CoBorrower.find({ student: req.user._id })
    .select("-kycData.aadhaarNumber -kycData.panNumber")
    .lean();

  res.status(200).json({
    success: true,
    count: coBorrowers.length,
    data: coBorrowers,
  });
});

// ============================================================================
// 4. GET SINGLE CO-BORROWER
// ============================================================================

exports.getCoBorrower = asyncHandler(async (req, res) => {
  const coBorrower = await CoBorrower.findOne({
    _id: req.params.coBorrowerId,
    student: req.user._id,
  })
    .select("-kycData.aadhaarNumber -kycData.panNumber")
    .lean();

  if (!coBorrower) {
    throw new AppError("Co-borrower not found", 404);
  }

  res.status(200).json({
    success: true,
    data: coBorrower,
  });
});

// ============================================================================
// 5. UPDATE CO-BORROWER
// ============================================================================

exports.updateCoBorrower = asyncHandler(async (req, res) => {
  const updates = req.body;

  // Remove protected fields
  delete updates._id;
  delete updates.student;
  delete updates.kycData;
  delete updates.financialInfo;
  delete updates.kycStatus;
  delete updates.financialVerificationStatus;

  const coBorrower = await CoBorrower.findOneAndUpdate(
    { _id: req.params.coBorrowerId, student: req.user._id },
    updates,
    { new: true, runValidators: true }
  ).select("-kycData.aadhaarNumber -kycData.panNumber");

  if (!coBorrower) {
    throw new AppError("Co-borrower not found", 404);
  }

  res.status(200).json({
    success: true,
    data: coBorrower,
    message: "Co-borrower updated successfully",
  });
});

// ============================================================================
// 6. DELETE CO-BORROWER
// ============================================================================

exports.deleteCoBorrower = asyncHandler(async (req, res) => {
  const coBorrower = await CoBorrower.findOneAndDelete({
    _id: req.params.coBorrowerId,
    student: req.user._id,
  });

  if (!coBorrower) {
    throw new AppError("Co-borrower not found", 404);
  }

  // TODO: Clean up Cloudinary files if needed
  // You can add cleanup logic here later

  res.status(200).json({
    success: true,
    message: "Co-borrower deleted successfully",
  });
});
