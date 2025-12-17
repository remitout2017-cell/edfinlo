// controllers/loanAnalysisController.js - FIXED VERSION

const Student = require("../models/students");
const AcademicRecords = require("../models/AcademicRecords");
const WorkExperience = require("../models/Workexperience");
const CoBorrower = require("../models/CoBorrower");
const AdmissionLetter = require("../models/AdmissionLetter");
const NBFC = require("../models/NBFC");
const LoanAnalysisHistory = require("../models/LoanAnalysisHistory");
const { analyzeStudentApplication } = require("../oldagents/loanEligibilityAgent");
const { analyzeStudentApplicationEnhanced } = require("../agents/enhancedLoanEligibilityAgentV2");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const NodeCache = require("node-cache");

// Cache for 1 hour (3600 seconds)
const analysisCache = new NodeCache({ stdTTL: 3600 });

/**
 * Helper to map score -> status label
 */
function getScoreStatus(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

/**
 * @desc Analyze student application for loan eligibility (BASIC)
 * @route POST /api/loan-analysis/analyze
 * @access Private (Student only)
 */
const analyzeLoanEligibility = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  const userId = req.user._id;
  const cacheKey = `loan-analysis-${userId}`;

  // Check cache first (skip if ?force=true in query)
  if (!req.query.force) {
    const cached = await analysisCache.get(cacheKey);
    if (cached) {
      console.log("📦 Returning cached analysis");
      return res.status(200).json({
        success: true,
        message: "Loan eligibility analysis (cached)",
        cached: true,
        data: cached,
      });
    }
  }

  try {
    console.log(`🔍 Starting loan eligibility analysis for user ${userId}`);

    // STEP 1: Fetch student data
    const student = await Student.findById(userId)
      .select("-password -emailVerificationToken -passwordResetToken")
      .lean();

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // STEP 2: Require verified KYC
    if (student.kycStatus !== "verified") {
      throw new AppError(
        "KYC verification is required before loan analysis. Please complete your KYC.",
        400
      );
    }

    // STEP 3: Fetch all related data in parallel
    const [academicRecords, workExperience, coBorrowers, admissionLetter] =
      await Promise.all([
        AcademicRecords.findOne({ user: userId }).lean(),
        WorkExperience.find({ user: userId }).lean(),
        CoBorrower.find({ student: userId })
          .select("-kycData.extractedData -financialInfo.extractedData")
          .lean(),
        AdmissionLetter.findOne({ user: userId }).lean(),
      ]);

    // STEP 4: Validate minimum data
    const validationErrors = [];

    if (!academicRecords) {
      validationErrors.push("Academic records not found");
    }

    if (!admissionLetter) {
      validationErrors.push(
        "Admission letter is required for loan application"
      );
    }

    if (!coBorrowers || coBorrowers.length === 0) {
      validationErrors.push(
        "At least one co-borrower is required for most loans"
      );
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Incomplete application",
        missingRequirements: validationErrors,
        message:
          "Please complete all required sections before requesting loan analysis",
      });
    }

    // STEP 5: Fetch all active NBFCs with their requirements
    const nbfcs = await NBFC.find({
      isActive: true,
      isApprovedByAdmin: true,
      "loanConfig.enabled": true,
    })
      .select("companyName brandName loanConfig stats email")
      .lean();

    if (nbfcs.length === 0) {
      throw new AppError(
        "No active NBFCs found in the system. Please try again later.",
        503
      );
    }

    console.log(`📊 Found ${nbfcs.length} active NBFCs for comparison`);

    // STEP 6: Prepare student data for analysis
    const studentData = {
      student: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phoneNumber: student.phoneNumber,
      },
      kycStatus: student.kycStatus,
      kycData: student.kycData,
      academicRecords,
      workExperience,
      coBorrowers,
      admissionLetter,
    };

    // STEP 7: Prepare NBFC requirements
    const nbfcRequirements = nbfcs.map((nbfc) => ({
      nbfcId: nbfc._id,
      nbfcName: nbfc.companyName,
      brandName: nbfc.brandName,
      email: nbfc.email,
      requirements: nbfc.loanConfig,
      stats: nbfc.stats,
    }));

    // STEP 8: Run AI analysis
    console.log("🤖 Starting AI-powered analysis...");
    const analysisResult = await analyzeStudentApplication(
      studentData,
      nbfcRequirements
    );

    // STEP 9: Categorize NBFCs by eligibility
    const categorizedNBFCs = {
      eligible: analysisResult.eligibleNBFCs.filter(
        (n) => n.eligibilityStatus === "eligible"
      ),
      borderline: analysisResult.eligibleNBFCs.filter(
        (n) => n.eligibilityStatus === "borderline"
      ),
      notEligible: analysisResult.eligibleNBFCs.filter(
        (n) => n.eligibilityStatus === "not_eligible"
      ),
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${duration}ms`);

    // STEP 10: Build response data
    const responseData = {
      overallScore: analysisResult.overallScore,
      processingTime: `${duration}ms`,

      // Section scores
      sectionScores: {
        academic: {
          score: analysisResult.academicAnalysis?.score || 0,
          status: getScoreStatus(analysisResult.academicAnalysis?.score || 0),
        },
        kyc: {
          score: analysisResult.kycAnalysis?.score || 0,
          status: getScoreStatus(analysisResult.kycAnalysis?.score || 0),
        },
        financial: {
          score: analysisResult.financialAnalysis?.score || 0,
          status: getScoreStatus(analysisResult.financialAnalysis?.score || 0),
        },
        workExperience: {
          score: analysisResult.workExperienceAnalysis?.score || 0,
          status: getScoreStatus(
            analysisResult.workExperienceAnalysis?.score || 0
          ),
        },
        admissionLetter: {
          score: analysisResult.admissionLetterAnalysis?.score || 0,
          status: getScoreStatus(
            analysisResult.admissionLetterAnalysis?.score || 0
          ),
        },
      },

      // NBFC matches
      nbfcMatches: {
        eligible: categorizedNBFCs.eligible,
        borderline: categorizedNBFCs.borderline,
        notEligible: categorizedNBFCs.notEligible,
        totalAnalyzed: nbfcs.length,
      },

      // Detailed analysis by section
      detailedAnalysis: {
        academic: analysisResult.academicAnalysis,
        kyc: analysisResult.kycAnalysis,
        financial: analysisResult.financialAnalysis,
        workExperience: analysisResult.workExperienceAnalysis,
        admissionLetter: analysisResult.admissionLetterAnalysis,
      },

      // Recommendations from agent
      recommendations: analysisResult.recommendations,

      // Summary / readiness
      summary: {
        eligibleNBFCCount: categorizedNBFCs.eligible.length,
        borderlineNBFCCount: categorizedNBFCs.borderline.length,
        totalNBFCsAnalyzed: nbfcs.length,
        applicationStrength:
          analysisResult.overallScore >= 80
            ? "Strong"
            : analysisResult.overallScore >= 60
              ? "Good"
              : analysisResult.overallScore >= 40
                ? "Fair"
                : "Needs Improvement",
        hasMinimumDocuments: true,
        isReadyToApply: categorizedNBFCs.eligible.length > 0,
      },
    };

    // STEP 11: Save to history (BASIC analysis)
    try {
      const historyData = {
        student: userId,
        analysisType: 'basic',
        overallScore: analysisResult.overallScore,
        
        sectionScores: responseData.sectionScores,
        
        nbfcMatches: {
          eligibleCount: categorizedNBFCs.eligible.length,
          borderlineCount: categorizedNBFCs.borderline.length,
          notEligibleCount: categorizedNBFCs.notEligible.length,
          totalAnalyzed: nbfcs.length,
          eligible: categorizedNBFCs.eligible,
          borderline: categorizedNBFCs.borderline,
          notEligible: categorizedNBFCs.notEligible,
        },
        
        detailedAnalysis: responseData.detailedAnalysis,
        
        studentSnapshot: {
          hasAcademicRecords: !!academicRecords,
          hasAdmissionLetter: !!admissionLetter,
          coBorrowerCount: coBorrowers?.length || 0,
          workExperienceCount: workExperience?.length || 0,
          kycStatus: student.kycStatus
        },
        
        processingTime: `${duration}ms`,
        cached: false,
        status: 'completed'
      };

      const savedHistory = await LoanAnalysisHistory.create(historyData);
      console.log(`💾 Analysis saved to history with ID: ${savedHistory._id}`);

      // Add historyId to response
      responseData.historyId = savedHistory._id;

    } catch (historyError) {
      console.error("❌ Failed to save analysis history:", historyError);
      console.error("History error details:", historyError.message);
      // Don't fail the request if history save fails
    }

    // Cache the result before returning
    await analysisCache.set(cacheKey, responseData);
    console.log(`💾 Analysis cached for user ${userId}`);

    // Return response
    return res.status(200).json({
      success: true,
      message: "Loan eligibility analysis completed successfully",
      cached: false,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Loan analysis error:", error);
    console.error("Error stack:", error.stack);

    // Save failed analysis to history
    try {
      await LoanAnalysisHistory.create({
        student: userId,
        analysisType: 'basic',
        overallScore: 0,
        status: 'failed',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    } catch (saveError) {
      console.error("Failed to save error to history:", saveError);
    }

    // Provide more specific error messages
    if (error.status === 429) {
      return next(
        new AppError(
          "Rate limit exceeded. Please try again in a few seconds.",
          429
        )
      );
    }

    next(error);
  }
});

/**
 * @desc Analyze with enhanced multi-agent system
 * @route POST /api/loan-analysis/analyze-enhanced
 * @access Private (Student only)
 */
const analyzeEnhancedEligibility = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  const userId = req.user._id;

  try {
    console.log("🚀 Starting enhanced analysis for user:", userId);

    // Fetch all student data
    const student = await Student.findById(userId).select("-password").lean();

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // STEP 2: Require verified KYC
    if (student.kycStatus !== "verified") {
      throw new AppError(
        "KYC verification is required before loan analysis. Please complete your KYC.",
        400
      );
    }

    const [academicRecords, workExperience, coBorrowers, admissionLetter] = await Promise.all([
      AcademicRecords.findOne({ user: userId }).lean(),
      WorkExperience.find({ user: userId }).lean(),
      CoBorrower.find({ student: userId }).lean(),
      AdmissionLetter.findOne({ user: userId }).lean(),
    ]);

    const nbfcs = await NBFC.find({ 
      isActive: true,
      isApprovedByAdmin: true,
      "loanConfig.enabled": true,
    })
      .select("companyName brandName loanConfig")
      .lean();

    const studentData = {
      student,
      kycStatus: student.kycStatus,
      kycData: student.kycData,
      academicRecords,
      workExperience,
      coBorrowers,
      admissionLetter,
      requestedLoanAmount: 1000000, // Default
    };

    const nbfcRequirements = nbfcs.map(nbfc => ({
      nbfcId: nbfc._id,
      nbfcName: nbfc.companyName,
      brandName: nbfc.brandName,
      requirements: nbfc.loanConfig,
    }));

    console.log("🤖 Running enhanced analysis...");

    // Run enhanced multi-agent analysis
    const analysisResult = await analyzeStudentApplicationEnhanced(studentData, nbfcRequirements);

    const duration = Date.now() - startTime;
    console.log(`✅ Enhanced analysis completed in ${duration}ms`);

    // ========== SAVE TO HISTORY ==========
    try {
      const historyData = {
        student: userId,
        analysisType: 'enhanced',
        overallScore: analysisResult.overallScore,

        sectionScores: {
          academic: {
            score: analysisResult.detailedAnalysis?.academic?.score || 0,
            status: getScoreStatus(analysisResult.detailedAnalysis?.academic?.score || 0)
          },
          financial: {
            score: analysisResult.detailedAnalysis?.financial?.score || 0,
            status: getScoreStatus(analysisResult.detailedAnalysis?.financial?.score || 0)
          },
          documents: {
            score: analysisResult.detailedAnalysis?.documents?.completenessScore || 0,
            completenessScore: analysisResult.detailedAnalysis?.documents?.completenessScore || 0
          },
          kyc: {
            score: student.kycStatus === 'verified' ? 85 : 0,
            status: student.kycStatus === 'verified' ? 'Verified' : 'Not Verified'
          },
          workExperience: {
            score: workExperience?.length > 0 ? 70 : 50,
            status: workExperience?.length > 0 ? 'Present' : 'Optional'
          },
          admissionLetter: {
            score: admissionLetter ? (admissionLetter.universityScore || 70) : 0,
            status: admissionLetter ? 'Present' : 'Missing'
          }
        },

        nbfcMatches: {
          eligibleCount: analysisResult.eligibleNBFCs?.length || 0,
          borderlineCount: analysisResult.detailedAnalysis?.nbfcMatching?.currentMatchSummary?.borderline || 0,
          notEligibleCount: analysisResult.detailedAnalysis?.nbfcMatching?.currentMatchSummary?.notEligible || 0,
          totalAnalyzed: nbfcRequirements.length,
          eligible: analysisResult.eligibleNBFCs || [],
          borderline: [],
          notEligible: []
        },

        detailedAnalysis: analysisResult.detailedAnalysis,
        masterRecommendations: analysisResult.masterRecommendations,
        improvementPotential: analysisResult.improvementPotential,

        studentSnapshot: {
          hasAcademicRecords: !!academicRecords,
          hasAdmissionLetter: !!admissionLetter,
          coBorrowerCount: coBorrowers?.length || 0,
          workExperienceCount: workExperience?.length || 0,
          kycStatus: student.kycStatus
        },

        processingTime: `${duration}ms`,
        cached: false,
        status: 'completed'
      };

      console.log('💾 Saving analysis to history...');
      console.log('History data keys:', Object.keys(historyData));
      console.log('Overall score:', historyData.overallScore);
      
      const savedHistory = await LoanAnalysisHistory.create(historyData);
      console.log(`✅ Analysis saved to history with ID: ${savedHistory._id}`);

      // Get comparison with previous analysis
      const comparison = await savedHistory.compareWithPrevious();

      return res.status(200).json({
        success: true,
        message: "Enhanced loan eligibility analysis completed",
        data: analysisResult,
        historyId: savedHistory._id,
        comparison
      });

    } catch (historyError) {
      console.error("❌ Failed to save analysis history:", historyError);
      console.error("History error stack:", historyError.stack);
      
      // Don't fail the request if history save fails
      return res.status(200).json({
        success: true,
        message: "Enhanced loan eligibility analysis completed (history save failed)",
        data: analysisResult,
        warning: "Analysis history could not be saved: " + historyError.message
      });
    }

  } catch (error) {
    console.error("❌ Enhanced analysis error:", error);
    console.error("Error stack:", error.stack);

    // Save failed analysis to history
    try {
      await LoanAnalysisHistory.create({
        student: userId,
        analysisType: 'enhanced',
        overallScore: 0,
        status: 'failed',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    } catch (saveError) {
      console.error("Failed to save error to history:", saveError);
    }

    next(error);
  }
});

/**
 * @desc Get analysis history for current student
 * @route GET /api/loan-analysis/history
 * @access Private (Student only)
 */
const getAnalysisHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, type } = req.query;

  console.log(`📋 Fetching history for user: ${userId}, page: ${page}, limit: ${limit}`);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    analysisType: type
  };

  try {
    const result = await LoanAnalysisHistory.getStudentHistory(userId, options);
    
    console.log(`✅ Found ${result.analyses.length} analyses for user ${userId}`);
    console.log('Stats:', result.stats);
    console.log('Pagination:', result.pagination);

    return res.status(200).json({
      success: true,
      message: "Analysis history retrieved successfully",
      data: result
    });
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    throw error;
  }
});

/**
 * @desc Get single analysis by ID
 * @route GET /api/loan-analysis/history/:analysisId
 * @access Private (Student only)
 */
const getAnalysisById = asyncHandler(async (req, res, next) => {
  const { analysisId } = req.params;
  const userId = req.user._id;

  console.log(`🔍 Fetching analysis ${analysisId} for user ${userId}`);

  const analysis = await LoanAnalysisHistory.findOne({
    _id: analysisId,
    student: userId
  }).lean();

  if (!analysis) {
    throw new AppError("Analysis not found", 404);
  }

  // Get comparison with previous
  const analysisDoc = await LoanAnalysisHistory.findById(analysisId);
  const comparison = await analysisDoc.compareWithPrevious();

  console.log(`✅ Found analysis ${analysisId}`);

  return res.status(200).json({
    success: true,
    data: {
      analysis,
      comparison
    }
  });
});

/**
 * @desc Compare two analyses
 * @route GET /api/loan-analysis/compare/:analysisId1/:analysisId2
 * @access Private (Student only)
 */
const compareAnalyses = asyncHandler(async (req, res, next) => {
  const { analysisId1, analysisId2 } = req.params;
  const userId = req.user._id;

  const [analysis1, analysis2] = await Promise.all([
    LoanAnalysisHistory.findOne({ _id: analysisId1, student: userId }).lean(),
    LoanAnalysisHistory.findOne({ _id: analysisId2, student: userId }).lean()
  ]);

  if (!analysis1 || !analysis2) {
    throw new AppError("One or both analyses not found", 404);
  }

  // Calculate differences
  const comparison = {
    overallScoreChange: analysis2.overallScore - analysis1.overallScore,
    nbfcEligibilityChange: {
      eligible: analysis2.nbfcMatches.eligibleCount - analysis1.nbfcMatches.eligibleCount,
      borderline: analysis2.nbfcMatches.borderlineCount - analysis1.nbfcMatches.borderlineCount
    },
    sectionChanges: {},
    timeBetween: Math.floor((new Date(analysis2.createdAt) - new Date(analysis1.createdAt)) / (1000 * 60 * 60 * 24))
  };

  // Compare each section
  ['academic', 'financial', 'documents', 'kyc', 'workExperience', 'admissionLetter'].forEach(section => {
    const score1 = analysis1.sectionScores?.[section]?.score || 0;
    const score2 = analysis2.sectionScores?.[section]?.score || 0;
    comparison.sectionChanges[section] = score2 - score1;
  });

  return res.status(200).json({
    success: true,
    data: {
      analysis1,
      analysis2,
      comparison
    }
  });
});

/**
 * @desc Delete analysis history
 * @route DELETE /api/loan-analysis/history/:analysisId
 * @access Private (Student only)
 */
const deleteAnalysisHistory = asyncHandler(async (req, res, next) => {
  const { analysisId } = req.params;
  const userId = req.user._id;

  console.log(`🗑️ Deleting analysis ${analysisId} for user ${userId}`);

  const deleted = await LoanAnalysisHistory.findOneAndDelete({
    _id: analysisId,
    student: userId
  });

  if (!deleted) {
    throw new AppError("Analysis not found", 404);
  }

  console.log(`✅ Deleted analysis ${analysisId}`);

  return res.status(200).json({
    success: true,
    message: "Analysis deleted successfully"
  });
});

/**
 * @desc Clear analysis cache for a user
 * @route DELETE /api/loan-analysis/cache
 * @access Private (Student only)
 */
const clearAnalysisCache = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const cacheKey = `loan-analysis-${userId}`;

  const deleted = await analysisCache.del(cacheKey);

  return res.status(200).json({
    success: true,
    message: deleted ? "Cache cleared successfully" : "No cache found",
    cleared: deleted > 0,
  });
});

/**
 * @desc Get application completeness status
 * @route GET /api/loan-analysis/completeness
 * @access Private (Student only)
 */
const getApplicationCompleteness = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const [
    student,
    academicRecords,
    workExperience,
    coBorrowers,
    admissionLetter,
  ] = await Promise.all([
    Student.findById(userId)
      .select("kycStatus firstName lastName email")
      .lean(),
    AcademicRecords.findOne({ user: userId }).lean(),
    WorkExperience.find({ user: userId }).lean(),
    CoBorrower.find({ student: userId }).lean(),
    AdmissionLetter.findOne({ user: userId }).lean(),
  ]);

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  const completeness = {
    profile: {
      complete: !!(student.firstName && student.lastName && student.email),
      percentage: 100,
    },
    kyc: {
      complete: student.kycStatus === "verified",
      status: student.kycStatus,
      percentage: student.kycStatus === "verified" ? 100 : 0,
    },
    academics: {
      complete: !!(
        academicRecords &&
        academicRecords.class10 &&
        academicRecords.class12
      ),
      hasClass10: !!academicRecords?.class10,
      hasClass12: !!academicRecords?.class12,
      hasHigherEducation: (academicRecords?.higherEducation?.length || 0) > 0,
      percentage: academicRecords
        ? (academicRecords.class10 ? 40 : 0) +
        (academicRecords.class12 ? 40 : 0) +
        ((academicRecords.higherEducation?.length || 0) > 0 ? 20 : 0)
        : 0,
    },
    workExperience: {
      complete: workExperience.length > 0,
      count: workExperience.length,
      percentage: workExperience.length > 0 ? 100 : 0,
      required: false, // Optional for most loans
    },
    coBorrower: {
      complete: coBorrowers.length > 0,
      count: coBorrowers.length,
      verified: coBorrowers.filter((cb) => cb.kycStatus === "verified").length,
      percentage:
        coBorrowers.length > 0
          ? (coBorrowers.filter((cb) => cb.kycStatus === "verified").length /
            coBorrowers.length) *
          100
          : 0,
    },
    admissionLetter: {
      complete: !!admissionLetter,
      percentage: admissionLetter ? 100 : 0,
    },
  };

  const overallPercentage = Math.round(
    completeness.profile.percentage * 0.1 +
    completeness.kyc.percentage * 0.2 +
    completeness.academics.percentage * 0.25 +
    completeness.workExperience.percentage * 0.05 +
    completeness.coBorrower.percentage * 0.2 +
    completeness.admissionLetter.percentage * 0.2
  );

  const missingItems = [];
  if (!completeness.kyc.complete) missingItems.push("KYC Verification");
  if (!completeness.academics.complete) missingItems.push("Academic Records");
  if (!completeness.coBorrower.complete)
    missingItems.push("Co-Borrower Information");
  if (!completeness.admissionLetter.complete)
    missingItems.push("Admission Letter");

  return res.status(200).json({
    success: true,
    data: {
      overallPercentage,
      isReadyForAnalysis: overallPercentage >= 70,
      completeness,
      missingItems,
      nextSteps:
        missingItems.length > 0
          ? [`Complete: ${missingItems.join(", ")}`]
          : [
            "Your application is complete! Click 'Analyze' to find matching NBFCs.",
          ],
    },
  });
});

// Export all functions
module.exports = {
  analyzeLoanEligibility,
  analyzeEnhancedEligibility,
  getApplicationCompleteness,
  getAnalysisHistory,
  getAnalysisById,
  compareAnalyses,
  deleteAnalysisHistory,
  clearAnalysisCache,
};