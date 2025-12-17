// controllersv2/coBorrowerControllerV2.js

const CoBorrower = require("../models/CoBorrower");
const Student = require("../models/students");
const { KYCAgent } = require("../ai/agents/documents/KYCAgent");
const { SalarySlipAgent } = require("../ai/agents/documents/SalarySlipAgent");
const {
  BankStatementAgent,
} = require("../ai/agents/documents/BankStatementAgent");
const { ITRAgent } = require("../ai/agents/documents/ITRAgent");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const {
  compressAndEncryptImage,
  uploadImageToCloudinary,
  deleteLocalFile,
} = require("../services/imageService");

// ============================================================================
// 🚀 CREATE CO-BORROWER WITH KYC
// ============================================================================
exports.createCoBorrowerV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = [];

  try {
    const {
      firstName,
      lastName,
      relationToStudent,
      email,
      phoneNumber,
      dateOfBirth,
    } = req.body;

    if (!firstName || !relationToStudent) {
      throw new AppError(
        "First name and relation to student are required",
        400
      );
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("KYC documents (Aadhaar and PAN) are required", 400);
    }

    // Collect file paths for cleanup
    Object.values(req.files)
      .flat()
      .forEach((f) => filePaths.push(f.path));

    console.log(`👥 Creating Co-Borrower for student ${req.user._id}`);

    // 1. Process KYC Documents
    const kycAgent = new KYCAgent();
    const kycDocuments = {
      aadhaarFront: req.files.aadhaarFront?.[0]?.path,
      aadhaarBack: req.files.aadhaarBack?.[0]?.path,
      panFront: req.files.panFront?.[0]?.path,
    };

    console.log("🆔 Extracting KYC information...");
    const kycResult = await kycAgent.processKYC({
      aadhaar: [kycDocuments.aadhaarFront, kycDocuments.aadhaarBack].filter(
        Boolean
      ),
      pan: [kycDocuments.panFront].filter(Boolean),
    });

    if (!kycResult || !kycResult.success) {
      throw new Error("Failed to process KYC documents");
    }

    // 2. Upload encrypted documents to Cloudinary
    console.log("☁️ Uploading encrypted KYC documents...");
    const uploadedDocs = {};

    for (const [field, files] of Object.entries(req.files)) {
      uploadedDocs[field] = [];
      for (const file of Array.isArray(files) ? files : [files]) {
        const encryptedBuffer = await compressAndEncryptImage(file.path);
        const url = await uploadImageToCloudinary(
          encryptedBuffer,
          `co_borrower/${req.user.id}/${field}-${Date.now()}.jpg`
        );
        uploadedDocs[field].push(url);
        await deleteLocalFile(file.path);
      }
    }

    // 3. Create Co-Borrower Record
    console.log("💾 Creating co-borrower record...");

    const coBorrowerData = {
      student: req.user._id,
      firstName,
      lastName,
      relationToStudent,
      email,
      phoneNumber,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,

      // KYC Data
      kycData: {
        aadhaarFrontUrls: uploadedDocs.aadhaarFront || [],
        aadhaarBackUrls: uploadedDocs.aadhaarBack || [],
        panFrontUrls: uploadedDocs.panFront || [],
        aadhaarNumber: kycResult.aadhaar?.aadhaarNumber,
        panNumber: kycResult.pan?.panNumber,
        aadhaarName: kycResult.aadhaar?.name,
        aadhaarDOB: kycResult.aadhaar?.dob
          ? new Date(kycResult.aadhaar.dob)
          : null,
        aadhaarGender: kycResult.aadhaar?.gender,
        aadhaarAddress: kycResult.aadhaar?.address,
        panName: kycResult.pan?.name,
        panDOB: kycResult.pan?.dob ? new Date(kycResult.pan.dob) : null,
        panFatherName: kycResult.pan?.fatherName,
        verification: {
          verified: kycResult.verification?.verified || false,
          confidence: (kycResult.verification?.confidence || 0) / 100,
          verificationDate: new Date(),
          method: "ai_extraction",
          matches: {
            name: kycResult.verification?.nameMatch || false,
            dob: kycResult.verification?.dobMatch || false,
            overall: kycResult.verification?.verified || false,
          },
        },
        processingMetadata: {
          extractedAt: new Date(),
          aiModel: "gemini-2.5-flash",
          confidence: (kycResult.verification?.confidence || 0) / 100,
          extractionQuality: "high",
        },
        lastVerifiedAt: new Date(),
      },

      kycStatus: kycResult.verification?.verified ? "verified" : "pending",
      kycVerifiedAt: kycResult.verification?.verified ? new Date() : null,
    };

    const coBorrower = await CoBorrower.create(coBorrowerData);

    // 4. Link to Student
    await Student.findByIdAndUpdate(req.user._id, {
      $push: { coBorrowers: coBorrower._id },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.status(201).json({
      success: true,
      message: "Co-Borrower created successfully",
      processingTime: `${duration}s`,
      coBorrowerId: coBorrower._id,
      kycStatus: coBorrower.kycStatus,
      data: {
        firstName: coBorrower.firstName,
        lastName: coBorrower.lastName,
        relationToStudent: coBorrower.relationToStudent,
        kycVerified: coBorrower.kycStatus === "verified",
      },
    });
  } catch (error) {
    console.error("❌ Co-Borrower Creation Error:", error);
    await Promise.allSettled(
      filePaths.map((p) => deleteLocalFile(p).catch(() => {}))
    );
    return next(
      new AppError(error.message || "Co-Borrower creation failed", 500)
    );
  }
});

// ============================================================================
// 💰 UPLOAD FINANCIAL DOCUMENTS
// ============================================================================
exports.uploadFinancialDocumentsV2 = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let filePaths = [];

  try {
    const { coBorrowerId } = req.params;

    const coBorrower = await CoBorrower.findOne({
      _id: coBorrowerId,
      student: req.user._id,
    });

    if (!coBorrower) {
      throw new AppError("Co-Borrower not found", 404);
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("No financial documents uploaded", 400);
    }

    Object.values(req.files)
      .flat()
      .forEach((f) => filePaths.push(f.path));

    console.log(
      `💰 Processing financial documents for co-borrower ${coBorrowerId}`
    );

    // Initialize agents
    const salarySlipAgent = new SalarySlipAgent();
    const bankStatementAgent = new BankStatementAgent();
    const itrAgent = new ITRAgent();

    const results = {};

    // 1. Process Salary Slips
    if (req.files.salarySlips && req.files.salarySlips.length > 0) {
      console.log("💵 Processing salary slips...");
      const salaryPaths = req.files.salarySlips.map((f) => f.path);

      try {
        const salaryResult = await salarySlipAgent.processSalarySlips(
          salaryPaths
        );
        results.salarySlips = salaryResult;
      } catch (error) {
        console.error("⚠️ Salary slip processing failed:", error.message);
        results.salarySlips = { success: false, error: error.message };
      }
    }

    // 2. Process Bank Statement
    if (req.files.bankStatement && req.files.bankStatement.length > 0) {
      console.log("🏦 Processing bank statement...");
      const bankPaths = req.files.bankStatement.map((f) => f.path);

      try {
        const bankResult = await bankStatementAgent.processBankStatement(
          bankPaths
        );

        // ✅ NULL SAFETY CHECK
        if (bankResult && bankResult.success && bankResult.accountDetails) {
          results.bankStatement = bankResult;
        } else {
          console.warn(
            "⚠️ Bank statement processing incomplete - no account details extracted"
          );
          results.bankStatement = {
            success: false,
            error: "Incomplete extraction",
          };
        }
      } catch (error) {
        console.error("⚠️ Bank statement processing failed:", error.message);
        results.bankStatement = { success: false, error: error.message };
      }
    }

    // 3. Process ITR
    if (req.files.itrDocuments && req.files.itrDocuments.length > 0) {
      console.log("📋 Processing ITR documents...");
      const itrPaths = req.files.itrDocuments.map((f) => f.path);

      try {
        const itrResult = await itrAgent.processITR(itrPaths);
        results.itr = itrResult;
      } catch (error) {
        console.error("⚠️ ITR processing failed:", error.message);
        results.itr = { success: false, error: error.message };
      }
    }

    // 4. Upload to Cloudinary
    console.log("☁️ Uploading encrypted financial documents...");
    const uploadedDocs = {};

    for (const [field, files] of Object.entries(req.files)) {
      uploadedDocs[field] = [];
      for (const file of files) {
        const encryptedBuffer = await compressAndEncryptImage(file.path);
        const url = await uploadImageToCloudinary(
          encryptedBuffer,
          `co_borrower_financial/${coBorrowerId}/${field}-${Date.now()}.jpg`
        );
        uploadedDocs[field].push(url);
        await deleteLocalFile(file.path);
      }
    }

    // 5. Update Co-Borrower with Financial Data
    console.log("💾 Updating co-borrower financial data...");

    const updateData = {
      financialInfo: coBorrower.financialInfo || {},
    };

    // Add Salary Slips
    if (results.salarySlips?.success && results.salarySlips.slips) {
      updateData.financialInfo.salarySlips = results.salarySlips.slips.map(
        (slip, idx) => ({
          month: slip.month,
          year: slip.year,
          employerName: slip.employerName,
          employeeName: slip.employeeName,
          basicSalary: slip.basicSalary,
          grossSalary: slip.grossSalary,
          netSalary: slip.netSalary,
          documentUrls: [uploadedDocs.salarySlips?.[idx]].filter(Boolean),
          processingMetadata: {
            extractedAt: new Date(),
            aiModel: "gemini-2.5-flash",
            confidence: (slip.confidence || 0) / 100,
          },
          isConsistent: true,
          uploadedAt: new Date(),
        })
      );
    }

    // Add Bank Statement
    if (
      results.bankStatement?.success &&
      results.bankStatement.accountDetails
    ) {
      const bank = results.bankStatement;
      updateData.financialInfo.bankStatement = {
        status: "verified",
        accountDetails: {
          accountNumber: bank.accountDetails?.accountNumber || "Not extracted",
          bankName: bank.accountDetails?.bankName || "Unknown",
          ifscCode: bank.accountDetails?.ifscCode,
          accountHolderName:
            bank.accountDetails?.accountHolderName || coBorrower.firstName,
        },
        overallAnalysis: {
          averageMonthlyBalance:
            bank.overallAnalysis?.cashFlow?.avgBalance || 0,
          salaryConsistency: {
            present: bank.overallAnalysis?.salaryConsistency?.present || false,
            averageAmount:
              bank.overallAnalysis?.salaryConsistency?.averageAmount || 0,
          },
          emiObligations: {
            totalMonthlyEMI:
              bank.overallAnalysis?.emiObligations?.totalMonthlyEMI || 0,
            numberOfLoans:
              bank.overallAnalysis?.emiObligations?.numberOfLoans || 0,
          },
        },
        documentUrls: uploadedDocs.bankStatement || [],
        processingMetadata: {
          extractedAt: new Date(),
          confidence: 0.8,
        },
      };
    } else {
      // ✅ FALLBACK FOR FAILED BANK STATEMENT
      console.warn("⚠️ Bank statement not processed - using minimal data");
      updateData.financialInfo.bankStatement = {
        status: "failed",
        accountDetails: {
          accountNumber: "Not extracted",
          bankName: "Unknown",
        },
        overallAnalysis: {
          averageMonthlyBalance: 0,
          salaryConsistency: {
            present: false,
            averageAmount: 0,
          },
          emiObligations: {
            totalMonthlyEMI: 0,
            numberOfLoans: 0,
          },
        },
        documentUrls: uploadedDocs.bankStatement || [],
        processingMetadata: {
          extractedAt: new Date(),
          confidence: 0,
          extractionStatus: "failed",
          error: results.bankStatement?.error || "Extraction failed",
        },
      };
    }

    // Add ITR Data
    if (results.itr?.success && results.itr.returns) {
      updateData.financialInfo.itrData = results.itr.returns.map(
        (itr, idx) => ({
          assessmentYear: itr.assessmentYear,
          financialYear: itr.financialYear,
          panNumber: itr.panNumber,
          name: itr.name,
          grossTotalIncome: itr.grossTotalIncome,
          taxableIncome: itr.taxableIncome,
          taxPaid: itr.taxPaid,
          documentUrls: [uploadedDocs.itrDocuments?.[idx]].filter(Boolean),
          processingMetadata: {
            extractedAt: new Date(),
            confidence: (itr.confidence || 0) / 100,
          },
          isVerified: true,
          uploadedAt: new Date(),
        })
      );
    }

    // Calculate Financial Summary
    updateData.financialInfo.financialSummary = calculateFinancialSummary(
      updateData.financialInfo
    );

    const updatedCoBorrower = await CoBorrower.findByIdAndUpdate(
      coBorrowerId,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.status(200).json({
      success: true,
      message: "Financial documents processed successfully",
      processingTime: `${duration}s`,
      summary: {
        salarySlipsProcessed: results.salarySlips?.slips?.length || 0,
        bankStatementProcessed: results.bankStatement?.success || false,
        itrProcessed: results.itr?.returns?.length || 0,
        avgMonthlySalary:
          updateData.financialInfo.financialSummary?.avgMonthlySalary,
        completenessScore:
          updateData.financialInfo.financialSummary?.documentCompleteness
            ?.completenessScore,
      },
    });
  } catch (error) {
    console.error("❌ Financial Documents Error:", error);
    await Promise.allSettled(
      filePaths.map((p) => deleteLocalFile(p).catch(() => {}))
    );
    return next(
      new AppError(
        error.message || "Financial documents processing failed",
        500
      )
    );
  }
});

// ============================================================================
// 🚀 CREATE CO-BORROWER MANUALLY (NO AI)
// ============================================================================
exports.createCoBorrowerManualV2 = asyncHandler(async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      relationToStudent,
      email,
      phoneNumber,
      dateOfBirth,
      // KYC Data (manual entry)
      aadhaarNumber,
      panNumber,
      aadhaarName,
      aadhaarDOB,
      aadhaarGender,
      aadhaarAddress,
      panName,
      panDOB,
      panFatherName,
    } = req.body;

    if (!firstName || !relationToStudent) {
      throw new AppError(
        "First name and relation to student are required",
        400
      );
    }

    console.log(`👥 Creating Co-Borrower (Manual) for student ${req.user._id}`);

    let uploadedDocs = {};

    // If files are provided, upload them
    if (req.files && Object.keys(req.files).length > 0) {
      console.log("☁️ Uploading KYC documents...");

      for (const [field, files] of Object.entries(req.files)) {
        uploadedDocs[field] = [];
        for (const file of Array.isArray(files) ? files : [files]) {
          const encryptedBuffer = await compressAndEncryptImage(file.path);
          const url = await uploadImageToCloudinary(
            encryptedBuffer,
            `co_borrower/${req.user.id}/${field}-${Date.now()}.jpg`
          );
          uploadedDocs[field].push(url);
          await deleteLocalFile(file.path);
        }
      }
    }

    // Create Co-Borrower Record with manual data
    const coBorrowerData = {
      student: req.user._id,
      firstName,
      lastName,
      relationToStudent,
      email,
      phoneNumber,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,

      // KYC Data (manually entered)
      kycData: {
        aadhaarFrontUrls: uploadedDocs.aadhaarFront || [],
        aadhaarBackUrls: uploadedDocs.aadhaarBack || [],
        panFrontUrls: uploadedDocs.panFront || [],
        aadhaarNumber,
        panNumber,
        aadhaarName: aadhaarName || firstName,
        aadhaarDOB: aadhaarDOB ? new Date(aadhaarDOB) : null,
        aadhaarGender,
        aadhaarAddress,
        panName: panName || firstName,
        panDOB: panDOB ? new Date(panDOB) : null,
        panFatherName,
        verification: {
          verified: false,
          confidence: 0.5,
          verificationDate: new Date(),
          method: "manual_entry",
          matches: {
            name: true,
            dob: true,
            overall: false,
          },
        },
        processingMetadata: {
          extractedAt: new Date(),
          aiModel: "manual",
          confidence: 0.5,
          extractionQuality: "manual",
        },
        lastVerifiedAt: new Date(),
      },

      kycStatus: "pending",
      kycVerifiedAt: null,
    };

    const coBorrower = await CoBorrower.create(coBorrowerData);

    // Link to Student
    await Student.findByIdAndUpdate(req.user._id, {
      $push: { coBorrowers: coBorrower._id },
    });

    res.status(201).json({
      success: true,
      message: "Co-Borrower created successfully (manual entry)",
      coBorrowerId: coBorrower._id,
      kycStatus: coBorrower.kycStatus,
      data: {
        firstName: coBorrower.firstName,
        lastName: coBorrower.lastName,
        relationToStudent: coBorrower.relationToStudent,
        kycVerified: false,
      },
    });
  } catch (error) {
    console.error("❌ Manual Co-Borrower Creation Error:", error);
    return next(
      new AppError(error.message || "Co-Borrower creation failed", 500)
    );
  }
});

// ============================================================================
// 💰 ADD SALARY SLIPS MANUALLY
// ============================================================================
exports.addSalarySlipsManualV2 = asyncHandler(async (req, res, next) => {
  try {
    const { coBorrowerId } = req.params;
    const { salarySlips } = req.body;

    const coBorrower = await CoBorrower.findOne({
      _id: coBorrowerId,
      student: req.user._id,
    });

    if (!coBorrower) {
      throw new AppError("Co-Borrower not found", 404);
    }

    // Initialize financialInfo if it doesn't exist
    if (!coBorrower.financialInfo) {
      coBorrower.financialInfo = {};
    }

    // Add manually entered salary slips
    coBorrower.financialInfo.salarySlips = salarySlips.map((slip) => ({
      month: slip.month,
      year: slip.year,
      employerName: slip.employerName,
      employeeName: slip.employeeName || coBorrower.firstName,
      basicSalary: slip.basicSalary,
      grossSalary: slip.grossSalary,
      netSalary: slip.netSalary,
      documentUrls: [],
      processingMetadata: {
        extractedAt: new Date(),
        aiModel: "manual",
        confidence: 0.5,
      },
      isConsistent: true,
      uploadedAt: new Date(),
    }));

    // Calculate financial summary
    coBorrower.financialInfo.financialSummary = calculateFinancialSummary(
      coBorrower.financialInfo
    );

    await coBorrower.save();

    res.status(200).json({
      success: true,
      message: "Salary slips added successfully",
      avgMonthlySalary:
        coBorrower.financialInfo.financialSummary.avgMonthlySalary,
    });
  } catch (error) {
    console.error("❌ Salary Slips Error:", error);
    return next(
      new AppError(error.message || "Failed to add salary slips", 500)
    );
  }
});

// ============================================================================
// 📥 GET CO-BORROWERS
// ============================================================================
exports.getCoBorrowersV2 = asyncHandler(async (req, res, next) => {
  const coBorrowers = await CoBorrower.find({ student: req.user._id })
    .select(
      "-kycData.aadhaarNumber -kycData.panNumber -financialInfo.bankStatement.accountDetails.accountNumber"
    )
    .lean();

  res.status(200).json({
    success: true,
    count: coBorrowers.length,
    data: coBorrowers.map((cb) => ({
      id: cb._id,
      fullName: `${cb.firstName} ${cb.lastName || ""}`.trim(),
      relationToStudent: cb.relationToStudent,
      kycStatus: cb.kycStatus,
      financialVerificationStatus: cb.financialVerificationStatus,
      avgMonthlySalary: cb.financialInfo?.financialSummary?.avgMonthlySalary,
      completenessScore:
        cb.financialInfo?.financialSummary?.documentCompleteness
          ?.completenessScore,
    })),
  });
});

// ============================================================================
// 🗑️ DELETE CO-BORROWER
// ============================================================================
exports.deleteCoBorrowerV2 = asyncHandler(async (req, res, next) => {
  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOneAndDelete({
    _id: coBorrowerId,
    student: req.user._id,
  });

  if (!coBorrower) {
    throw new AppError("Co-Borrower not found", 404);
  }

  await Student.findByIdAndUpdate(req.user._id, {
    $pull: { coBorrowers: coBorrowerId },
  });

  res.status(200).json({
    success: true,
    message: "Co-Borrower deleted successfully",
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateFinancialSummary(financialInfo) {
  const summary = {
    avgMonthlySalary: 0,
    avgMonthlyIncome: 0,
    estimatedAnnualIncome: 0,
    totalExistingEmi: 0,
    foir: 0,
    incomeSource: "other",
    salarySlipCount: financialInfo.salarySlips?.length || 0,
    itrYearsCovered: financialInfo.itrData?.length || 0,
    documentCompleteness: {
      hasKYC: true,
      hasSalarySlips: (financialInfo.salarySlips?.length || 0) >= 3,
      hasBankStatement: financialInfo.bankStatement?.status === "verified",
      hasITR: (financialInfo.itrData?.length || 0) >= 2,
      completenessScore: 0,
    },
    verificationStatus: {
      overall: "pending",
    },
  };

  // Calculate average salary
  if (financialInfo.salarySlips && financialInfo.salarySlips.length > 0) {
    const totalNet = financialInfo.salarySlips.reduce(
      (sum, slip) => sum + (slip.netSalary || 0),
      0
    );
    summary.avgMonthlySalary = Math.round(
      totalNet / financialInfo.salarySlips.length
    );
    summary.avgMonthlyIncome = summary.avgMonthlySalary;
    summary.incomeSource = "salaried";
  }

  // Get EMI from bank statement
  if (
    financialInfo.bankStatement?.overallAnalysis?.emiObligations
      ?.totalMonthlyEMI
  ) {
    summary.totalExistingEmi =
      financialInfo.bankStatement.overallAnalysis.emiObligations.totalMonthlyEMI;
  }

  // Calculate annual income and FOIR
  if (summary.avgMonthlyIncome > 0) {
    summary.estimatedAnnualIncome = Math.round(summary.avgMonthlyIncome * 12);
    summary.foir = parseFloat(
      ((summary.totalExistingEmi / summary.avgMonthlyIncome) * 100).toFixed(2)
    );
  }

  // Completeness score
  let score = 20; // Base for having KYC
  if (summary.documentCompleteness.hasSalarySlips) score += 30;
  if (summary.documentCompleteness.hasBankStatement) score += 30;
  if (summary.documentCompleteness.hasITR) score += 20;
  summary.documentCompleteness.completenessScore = score;

  // Overall status
  if (score >= 80) {
    summary.verificationStatus.overall = "verified";
  } else if (score >= 50) {
    summary.verificationStatus.overall = "pending";
  } else {
    summary.verificationStatus.overall = "failed";
  }

  return summary;
}
