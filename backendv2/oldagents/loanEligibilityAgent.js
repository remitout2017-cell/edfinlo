// agents/loanEligibilityAgent.js - FULLY FIXED VERSION WITH ALL BUGS RESOLVED

const { ChatGroq } = require("@langchain/groq");
const config = require("../config/config");

// ============================================================================
// CONFIGURATION - FIXED API KEY ACCESS
// ============================================================================

const getApiKey = () => {
  return config.ai?.groqApiKey || config.groqApiKey || process.env.GROQ_API_KEY;
};

// ✅ FIXED: Using valid Groq model names
const llm = new ChatGroq({
  apiKey: getApiKey(),
  model: "llama-3.3-70b-versatile", // ✅ Valid model - 8K TPM
  temperature: 0.2,
  maxTokens: 1500,
  timeout: 30000,
});

// Fallback for rate limiting
const llmBackup = new ChatGroq({
  apiKey: getApiKey(),
  model: "mixtral-8x7b-32768", // ✅ Alternative valid model
  temperature: 0.2,
  maxTokens: 1500,
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Safe JSON parser with better error handling
 */
function safeJSONParse(raw, fallback, contextLabel) {
  try {
    if (!raw) {
      console.warn(`⚠️ ${contextLabel}: empty response, using fallback`);
      return fallback;
    }

    const text = typeof raw === "string" ? raw : String(raw);
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      console.warn(`⚠️ ${contextLabel}: no JSON found, using fallback`);
      return fallback;
    }

    const jsonSlice = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(jsonSlice);
    console.log(`✅ ${contextLabel}: parsed successfully`);
    return parsed;
  } catch (err) {
    console.error(`❌ ${contextLabel} parse error:`, err.message);
    console.error(
      `Raw response (first 300 chars):`,
      String(raw).substring(0, 300)
    );
    return fallback;
  }
}

/**
 * Retry wrapper with exponential backoff for rate limits
 */
async function retryWithBackoff(
  fn,
  maxRetries = 3,
  baseDelay = 7000,
  contextLabel = "Operation"
) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(
        `❌ ${contextLabel} - Attempt ${i + 1}/${maxRetries} failed:`,
        error.message
      );

      if (error.status === 429 && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(
          `⏳ Rate limited, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else if (i < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, i);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw (
    lastError || new Error(`${contextLabel} failed after ${maxRetries} retries`)
  );
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze Academic Records
 */
async function analyzeAcademicRecords(state) {
  console.log("🎓 Analyzing Academic Records...");
  const academicData = state.studentData.academicRecords;

  if (!academicData) {
    return {
      score: 0,
      strengths: [],
      issues: ["No academic records found"],
      recommendations: ["Upload Class 10, 12, and higher education records"],
      gapYears: 0,
      hasConsistentProgress: false,
    };
  }

  // Extract percentages safely
  const class10Pct =
    academicData.class10?.marksheets?.[0]?.percentage ||
    academicData.class10?.percentage ||
    0;
  const class12Pct =
    academicData.class12?.marksheets?.[0]?.percentage ||
    academicData.class12?.percentage ||
    0;
  const higherEdCount = academicData.higherEducation?.length || 0;

  // Compact prompt - NO markdown formatting request
  const prompt = `Analyze education loan academic records. Return ONLY valid JSON with no markdown, no code blocks, no extra text.

Academic Data:
- Class 10: ${class10Pct}% (Board: ${
    academicData.class10?.marksheets?.[0]?.boardUniversity ||
    academicData.class10?.board ||
    "N/A"
  })
- Class 12: ${class12Pct}% (Stream: ${academicData.class12?.stream || "N/A"})
- Higher Education: ${higherEdCount} entries

Return this exact JSON structure:
{
  "score": <0-100 number>,
  "strengths": ["strength1", "strength2"],
  "issues": ["issue1", "issue2"],
  "recommendations": ["rec1", "rec2"],
  "gapYears": <number>,
  "hasConsistentProgress": <boolean>
}`;

  return retryWithBackoff(
    async () => {
      const response = await llm.invoke(prompt);
      // Calculate fallback score based on actual data
      const fallbackScore = Math.round((class10Pct + class12Pct) / 2);

      return safeJSONParse(
        response.content,
        {
          score: fallbackScore,
          strengths:
            class10Pct >= 60 && class12Pct >= 60
              ? ["Good academic foundation"]
              : [],
          issues:
            class10Pct < 60 || class12Pct < 60
              ? ["Academic scores below typical NBFC thresholds"]
              : [],
          recommendations:
            higherEdCount === 0
              ? ["Add higher education records if applicable"]
              : [],
          gapYears: 0,
          hasConsistentProgress: true,
        },
        "Academic"
      );
    },
    3,
    7000,
    "AcademicAnalysis"
  );
}

/**
 * Analyze KYC
 */
async function analyzeKYC(state) {
  console.log("🪪 Analyzing KYC...");
  const kycData = state.studentData.kycData;
  const kycStatus = state.studentData.kycStatus;

  if (!kycData || kycStatus !== "verified") {
    return {
      score: kycStatus === "verified" ? 80 : 0,
      verified: kycStatus === "verified",
      issues: kycStatus !== "verified" ? ["KYC not verified"] : [],
      recommendations:
        kycStatus !== "verified" ? ["Complete KYC verification"] : [],
      documentsComplete: false,
      verificationConfidence: 0,
    };
  }

  const hasAadhaar = !!(kycData.aadhaarName || kycData.aadhaarNumber);
  const hasPAN = !!(kycData.panName || kycData.panNumber);
  const confidence = kycData.verificationConfidence || 0;

  const prompt = `KYC verification analysis. Return ONLY valid JSON with no markdown, no code blocks, no extra text.

KYC Status:
- Verification: ${kycStatus}
- Aadhaar: ${hasAadhaar ? "Present" : "Missing"}
- PAN: ${hasPAN ? "Present" : "Missing"}
- Confidence: ${confidence}%

Return this exact JSON structure:
{
  "score": <0-100 number>,
  "verified": <boolean>,
  "issues": ["issue1"],
  "recommendations": ["rec1"],
  "documentsComplete": <boolean>,
  "verificationConfidence": <0-100 number>
}`;

  return retryWithBackoff(
    async () => {
      const response = await llm.invoke(prompt);
      return safeJSONParse(
        response.content,
        {
          score: kycStatus === "verified" ? 85 : 0,
          verified: kycStatus === "verified",
          issues: [],
          recommendations: [],
          documentsComplete: hasAadhaar && hasPAN,
          verificationConfidence: confidence,
        },
        "KYC"
      );
    },
    3,
    7000,
    "KYCAnalysis"
  );
}

/**
 * ✅ FIXED: Analyze Financials with complete prompt
 */
async function analyzeFinancials(state) {
  console.log("💰 Analyzing Financials...");
  const coBorrowers = state.studentData.coBorrowers || [];

  if (coBorrowers.length === 0) {
    return {
      score: 0,
      hasCoBorrower: false,
      coBorrowerCount: 0,
      totalMonthlyIncome: 0,
      averageFOIR: 0,
      financialStability: "Unknown",
      strengths: [],
      issues: ["No co-borrower added"],
      recommendations: ["Add at least one co-borrower with stable income"],
      loanCapacity: { estimatedMaxLoan: 0, reasoning: "No co-borrower" },
    };
  }

  // Calculate totals safely
  const totalIncome = coBorrowers.reduce((sum, cb) => {
    const income =
      cb.financialInfo?.financialSummary?.avgMonthlyIncome ||
      cb.grossMonthlyIncome ||
      0;
    return sum + income;
  }, 0);

  const totalEMI = coBorrowers.reduce((sum, cb) => {
    const emi =
      cb.financialInfo?.financialSummary?.totalExistingEmi ||
      cb.totalEmiAmount ||
      0;
    return sum + emi;
  }, 0);

  const foir = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;

  // ✅ FIXED: Complete prompt with full JSON structure
  const prompt = `Financial analysis for education loan. Return ONLY valid JSON with no markdown, no code blocks, no extra text.

Financial Data:
- Co-borrowers: ${coBorrowers.length}
- Total Monthly Income: ₹${totalIncome}
- Existing EMI: ₹${totalEMI}
- FOIR: ${foir.toFixed(1)}%
- Relations: ${coBorrowers.map((cb) => cb.relationToStudent).join(", ")}

Return this exact JSON structure:
{
  "score": <0-100 number>,
  "financialStability": "Strong|Good|Fair|Weak",
  "strengths": ["strength1"],
  "issues": ["issue1"],
  "recommendations": ["rec1"],
  "loanCapacity": {
    "estimatedMaxLoan": <number>,
    "reasoning": "text"
  }
}`;

  return retryWithBackoff(
    async () => {
      const response = await llm.invoke(prompt);

      // Calculate fallback score
      let fallbackScore = 40;
      if (totalIncome > 50000) fallbackScore = 80;
      else if (totalIncome > 30000) fallbackScore = 65;
      else if (totalIncome > 20000) fallbackScore = 50;

      if (foir > 60) fallbackScore -= 20;
      else if (foir > 40) fallbackScore -= 10;

      const analysis = safeJSONParse(
        response.content,
        {
          score: Math.max(0, fallbackScore),
          financialStability: totalIncome > 40000 ? "Good" : "Fair",
          strengths:
            totalIncome > 30000 ? [`Total income: ₹${totalIncome}`] : [],
          issues: foir > 50 ? [`High FOIR: ${foir.toFixed(1)}%`] : [],
          recommendations:
            totalIncome < 30000 ? ["Add co-borrower with higher income"] : [],
          loanCapacity: {
            estimatedMaxLoan: Math.round(totalIncome * 60),
            reasoning: "60x monthly income (conservative estimate)",
          },
        },
        "Financial"
      );

      return {
        ...analysis,
        hasCoBorrower: true,
        coBorrowerCount: coBorrowers.length,
        totalMonthlyIncome: totalIncome,
        averageFOIR: foir,
      };
    },
    3,
    7000,
    "FinancialAnalysis"
  );
}

/**
 * ✅ NEW: Analyze CIBIL Score
 */
async function analyzeCIBIL(state) {
  console.log("📊 Analyzing CIBIL Score...");

  const coBorrowers = state.studentData.coBorrowers || [];

  if (coBorrowers.length === 0) {
    return {
      score: 0,
      hasCibilData: false,
      averageCibilScore: 0,
      lowestScore: 0,
      highestScore: 0,
      strengths: [],
      issues: ["No co-borrower CIBIL data available"],
      recommendations: ["Add co-borrower and verify CIBIL score"],
    };
  }

  // Extract CIBIL scores from co-borrowers
  const cibilScores = coBorrowers
    .map(cb => cb.financialInfo?.cibilScore || cb.cibilScore || 0)
    .filter(score => score > 0);

  if (cibilScores.length === 0) {
    return {
      score: 0,
      hasCibilData: false,
      averageCibilScore: 0,
      lowestScore: 0,
      highestScore: 0,
      strengths: [],
      issues: ["CIBIL score not available for co-borrowers"],
      recommendations: ["Upload CIBIL reports for all co-borrowers"],
    };
  }

  const avgCibil = Math.round(
    cibilScores.reduce((sum, s) => sum + s, 0) / cibilScores.length
  );
  const lowestScore = Math.min(...cibilScores);
  const highestScore = Math.max(...cibilScores);

  // Rule-based scoring
  let score = 0;
  if (avgCibil >= 750) score = 95;
  else if (avgCibil >= 700) score = 80;
  else if (avgCibil >= 650) score = 65;
  else if (avgCibil >= 600) score = 45;
  else if (avgCibil >= 550) score = 25;
  else score = 10;

  const strengths = [];
  const issues = [];
  const recommendations = [];

  if (avgCibil >= 750) {
    strengths.push(`Excellent CIBIL score: ${avgCibil}`);
  } else if (avgCibil >= 700) {
    strengths.push(`Good CIBIL score: ${avgCibil}`);
  }

  if (avgCibil < 650) {
    issues.push(`CIBIL score below most NBFC thresholds: ${avgCibil}`);
    recommendations.push("Work on improving CIBIL score before applying");
  }

  if (lowestScore < 600 && cibilScores.length > 1) {
    issues.push(`One co-borrower has low CIBIL: ${lowestScore}`);
    recommendations.push("Consider replacing co-borrower with low CIBIL");
  }

  return {
    score,
    hasCibilData: true,
    averageCibilScore: avgCibil,
    lowestScore,
    highestScore,
    strengths,
    issues,
    recommendations,
  };
}

/**
 * Analyze Work Experience (simplified - mostly rule-based)
 */
async function analyzeWorkExperience(state) {
  console.log("💼 Analyzing Work Experience...");
  const workExperience = state.studentData.workExperience || [];

  // Rule-based for simple cases - no LLM needed
  if (workExperience.length === 0) {
    return {
      score: 50, // Neutral - not mandatory
      hasExperience: false,
      totalMonths: 0,
      totalYears: 0,
      employmentTypes: [],
      verified: false,
      strengths: [],
      recommendations: ["Optional: Add work experience if applicable"],
      addedValue: "Not mandatory for most education loans",
    };
  }

  const totalMonths = workExperience.reduce(
    (sum, we) => sum + (we.monthsWorked || 0),
    0
  );
  const totalYears = Math.floor(totalMonths / 12);
  const hasVerified = workExperience.some((we) => we.verified);

  // Simple scoring
  let score = 50; // Base
  score += Math.min(totalMonths * 2, 30); // Up to +30 for experience
  if (hasVerified) score += 10; // +10 for verification

  return {
    score: Math.min(score, 90),
    hasExperience: true,
    totalMonths,
    totalYears,
    employmentTypes: [
      ...new Set(workExperience.map((we) => we.employmentType)),
    ],
    verified: hasVerified,
    strengths: [
      `${totalYears} year${totalYears !== 1 ? "s" : ""} of work experience`,
      ...(hasVerified ? ["Experience verified"] : []),
    ],
    recommendations: hasVerified ? [] : ["Get work experience verified"],
    addedValue: "Adds credibility to profile",
  };
}

/**
 * Analyze Admission Letter
 */
async function analyzeAdmissionLetter(state) {
  console.log("📧 Analyzing Admission Letter...");
  const admissionLetter = state.studentData.admissionLetter;

  if (!admissionLetter) {
    return {
      score: 0,
      hasLetter: false,
      universityScore: 0,
      riskLevel: "High",
      universityTier: "Unknown",
      programQuality: "Unknown",
      strengths: [],
      issues: ["No admission letter uploaded"],
      recommendations: ["Upload admission letter from university"],
    };
  }

  // Rule-based if we have university score already
  const uniScore = admissionLetter.universityScore || 70;

  return {
    score: uniScore,
    hasLetter: true,
    universityScore: uniScore,
    riskLevel: admissionLetter.riskLevel || "Low",
    universityTier:
      uniScore >= 80 ? "Tier 1" : uniScore >= 60 ? "Tier 2" : "Tier 3",
    programQuality: uniScore >= 70 ? "Good" : "Fair",
    strengths: [
      `University: ${admissionLetter.universityName || "Not specified"}`,
      `Country: ${admissionLetter.country || "Not specified"}`,
      `Program: ${admissionLetter.programName || "Not specified"}`,
    ].filter((s) => !s.includes("Not specified")),
    issues: admissionLetter.issuesFound || [],
    recommendations:
      admissionLetter.issuesFound?.length > 0
        ? ["Review and resolve admission letter issues"]
        : [],
  };
}

/**
 * ✅ FIXED: Match NBFC Eligibility with correct data structure
 */
async function matchNBFCEligibility(state) {
  console.log("🏦 Matching NBFC Eligibility...");

  const scores = {
    academic: state.academicAnalysis?.score || 0,
    kyc: state.kycAnalysis?.score || 0,
    financial: state.financialAnalysis?.score || 0,
    cibil: state.cibilAnalysis?.score || 0, // ✅ NEW
    workExp: state.workExperienceAnalysis?.score || 0,
    admission: state.admissionLetterAnalysis?.score || 0,
  };

  // ✅ UPDATED: New weights including CIBIL
  const overallScore = Math.round(
    scores.academic * 0.20 +
    scores.kyc * 0.15 +
    scores.financial * 0.25 +
    scores.cibil * 0.15 + // ✅ NEW
    scores.workExp * 0.05 +
    scores.admission * 0.20
  );

  console.log(`📊 Calculated Overall Score: ${overallScore}/100`);
  console.log(`   - Academic: ${scores.academic}`);
  console.log(`   - KYC: ${scores.kyc}`);
  console.log(`   - Financial: ${scores.financial}`);
  console.log(`   - CIBIL: ${scores.cibil}`);
  console.log(`   - Work Exp: ${scores.workExp}`);
  console.log(`   - Admission: ${scores.admission}`);

  // ✅ FIXED: Using loanConfig instead of requirements
  const nbfcSummary = state.nbfcRequirements
    .slice(0, 5) // Limit to prevent token overflow
    .map((n) => {
      const minIncome =
        n.loanConfig?.incomeItr?.minMonthlySalary || 25000; // ✅ FIXED
      const minCibil =
        n.loanConfig?.cibil?.minScore || 650; // ✅ FIXED
      return `${n.nbfcName || n.companyName}: Income≥₹${minIncome}, CIBIL≥${minCibil}`;
    })
    .join("\n");

  const prompt = `Match student profile to NBFCs for education loan. Return ONLY valid JSON array with no markdown, no code blocks, no extra text.

Student Profile:
- Overall Score: ${overallScore}/100
- Monthly Income: ₹${state.financialAnalysis?.totalMonthlyIncome || 0}
- FOIR: ${state.financialAnalysis?.averageFOIR?.toFixed(1) || 0}%
- Academic: ${scores.academic}/100
- CIBIL: ${state.cibilAnalysis?.averageCibilScore || "Not Available"}
- KYC: ${scores.kyc === 0 ? "Not Verified" : "Verified"}

NBFCs to Match:
${nbfcSummary}

Return this exact JSON array structure (one object per NBFC):
[
  {
    "nbfcId": "use actual ID from list",
    "nbfcName": "use actual name from list",
    "eligibilityStatus": "eligible|borderline|not_eligible",
    "matchPercentage": <0-100 number>,
    "strengths": ["strength1"],
    "gaps": ["gap1"],
    "specificRecommendations": ["rec1"],
    "estimatedLoanAmount": {"min": <number>, "max": <number>, "currency": "INR"},
    "estimatedROI": {"min": <number>, "max": <number>},
    "approvalProbability": "High|Medium|Low"
  }
]`;

  return retryWithBackoff(
    async () => {
      const response = await llmBackup.invoke(prompt);

      // Parse with better error handling
      let nbfcs = [];
      try {
        const text =
          typeof response.content === "string"
            ? response.content
            : String(response.content);

        // Remove markdown code blocks
        let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");

        // Look for array brackets
        const arrayStart = cleaned.indexOf("[");
        const arrayEnd = cleaned.lastIndexOf("]");

        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          const jsonSlice = cleaned.slice(arrayStart, arrayEnd + 1);
          nbfcs = JSON.parse(jsonSlice);
          console.log(`✅ NBFC Matching: parsed ${nbfcs.length} NBFCs`);
        } else {
          console.warn(
            "⚠️ NBFC Matching: no array found, using rule-based fallback"
          );
          nbfcs = [];
        }
      } catch (err) {
        console.error("❌ NBFC Matching parse error:", err.message);
        console.error(
          "Raw response (first 500 chars):",
          String(response.content).substring(0, 500)
        );
        nbfcs = [];
      }

      // ✅ FIXED: Fill in missing NBFCs with rule-based approach using loanConfig
      const processedIds = new Set(nbfcs.map((n) => n.nbfcId || n.nbfcName));

      state.nbfcRequirements.forEach((nbfc) => {
        const isProcessed =
          processedIds.has(nbfc._id) || 
          processedIds.has(nbfc.nbfcId) || 
          processedIds.has(nbfc.companyName);

        if (!isProcessed) {
          // ✅ FIXED: Using loanConfig structure
          const minIncome = nbfc.loanConfig?.incomeItr?.minMonthlySalary || 25000;
          const minCibil = nbfc.loanConfig?.cibil?.minScore || 650;
          const maxFOIR = nbfc.loanConfig?.foir?.maxPercentage || 75;

          const totalIncome = state.financialAnalysis?.totalMonthlyIncome || 0;
          const avgCibil = state.cibilAnalysis?.averageCibilScore || 0;
          const currentFOIR = state.financialAnalysis?.averageFOIR || 0;

          let eligibility = "not_eligible";
          let probability = "Low";
          const gaps = [];
          const specificRecs = [];

          // Check income
          const incomeOk = totalIncome >= minIncome;
          if (!incomeOk) {
            gaps.push(`Income below minimum: ₹${totalIncome} < ₹${minIncome}`);
            specificRecs.push(`Increase co-borrower income to ₹${minIncome}+`);
          }

          // Check CIBIL
          const cibilOk = avgCibil >= minCibil || avgCibil === 0;
          if (avgCibil > 0 && avgCibil < minCibil) {
            gaps.push(`CIBIL below minimum: ${avgCibil} < ${minCibil}`);
            specificRecs.push(`Improve CIBIL score to ${minCibil}+`);
          } else if (avgCibil === 0) {
            gaps.push("CIBIL score not available");
            specificRecs.push("Upload CIBIL report");
          }

          // Check FOIR
          const foirOk = currentFOIR <= maxFOIR;
          if (!foirOk) {
            gaps.push(`FOIR too high: ${currentFOIR.toFixed(1)}% > ${maxFOIR}%`);
            specificRecs.push("Reduce existing EMI obligations");
          }

          // Determine eligibility
          if (incomeOk && cibilOk && foirOk && overallScore >= 70) {
            eligibility = "eligible";
            probability = "High";
          } else if (
            (incomeOk || totalIncome >= minIncome * 0.8) &&
            (cibilOk || avgCibil >= minCibil - 50) &&
            overallScore >= 50
          ) {
            eligibility = "borderline";
            probability = "Medium";
          }

          nbfcs.push({
            nbfcId: nbfc._id || nbfc.nbfcId,
            nbfcName: nbfc.companyName || nbfc.nbfcName,
            brandName: nbfc.brandName,
            eligibilityStatus: eligibility,
            matchPercentage: overallScore,
            strengths: overallScore >= 60 ? [`Overall score: ${overallScore}/100`] : [],
            gaps,
            specificRecommendations: specificRecs,
            estimatedLoanAmount:
              eligibility === "eligible"
                ? {
                    min: 500000,
                    max: Math.round(totalIncome * 60),
                    currency: "INR",
                  }
                : { min: 0, max: 0, currency: "INR" },
            estimatedROI:
              eligibility === "eligible"
                ? { 
                    min: nbfc.loanConfig?.roi?.minRate || 9, 
                    max: nbfc.loanConfig?.roi?.maxRate || 13 
                  }
                : { min: 0, max: 0 },
            approvalProbability: probability,
          });
        }
      });

      return { nbfcs, overallScore };
    },
    3,
    7000,
    "NBFCMatching"
  );
}

/**
 * Generate Overall Recommendations
 */
async function generateOverallRecommendations(state) {
  console.log("📋 Generating Recommendations...");

  const eligibleCount = state.eligibleNBFCs.filter(
    (n) => n.eligibilityStatus === "eligible"
  ).length;

  // Rule-based recommendations
  const criticalActions = [];
  const importantImprovements = [];

  if (state.academicAnalysis?.score < 50)
    criticalActions.push("Improve academic documentation and scores");

  if (state.kycAnalysis?.score < 80)
    criticalActions.push("Complete KYC verification immediately");

  if (state.financialAnalysis?.score < 50)
    criticalActions.push("Add co-borrower with stable monthly income ₹30,000+");

  // ✅ NEW: CIBIL recommendations
  if (state.cibilAnalysis?.score < 50)
    criticalActions.push("Improve CIBIL score above 650");

  if (!state.admissionLetterAnalysis?.hasLetter)
    criticalActions.push("Upload valid admission letter from university");

  if (state.financialAnalysis?.averageFOIR > 50)
    importantImprovements.push(
      "Reduce existing EMI obligations to improve FOIR"
    );

  if (
    state.workExperienceAnalysis?.score < 60 &&
    state.workExperienceAnalysis?.hasExperience
  )
    importantImprovements.push("Get work experience documents verified");

  if (state.academicAnalysis?.score < 70)
    importantImprovements.push(
      "Ensure all academic records are complete and verified"
    );

  // ✅ NEW: CIBIL specific improvements
  if (state.cibilAnalysis?.averageCibilScore > 0 && 
      state.cibilAnalysis?.averageCibilScore < 700)
    importantImprovements.push(
      "Work on improving CIBIL score to 700+ for better loan terms"
    );

  return {
    criticalActions,
    importantImprovements,
    optionalEnhancements: [
      "Consider applying to multiple NBFCs for better rates",
      "Explore scholarship opportunities to reduce loan amount",
    ],
    longTermStrategies: [
      "Maintain good credit score above 750",
      "Build relationship with co-borrower's bank",
      "Keep debt-to-income ratio below 40%",
    ],
    overallAssessment:
      eligibleCount > 0
        ? `You're eligible for ${eligibleCount} NBFC(s). Ready to apply!`
        : state.overallScore >= 50
        ? `You're close! Complete ${criticalActions.length} critical action(s) to become eligible.`
        : "Significant improvements needed. Focus on critical actions first.",
    estimatedTimeToImprove:
      criticalActions.length > 3
        ? "3-4 weeks"
        : criticalActions.length > 1
        ? "2-3 weeks"
        : "1-2 weeks",
    successProbability:
      eligibleCount > 0 ? "High" : state.overallScore >= 50 ? "Medium" : "Low",
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * ✅ UPDATED: MAIN ANALYSIS FUNCTION with CIBIL integration
 */
async function analyzeStudentApplication(studentData, nbfcRequirements) {
  console.log("🚀 Starting comprehensive loan eligibility analysis...");
  console.log(`📊 Analyzing against ${nbfcRequirements.length} NBFCs`);

  try {
    // ✅ UPDATED: Run all analyses including CIBIL
    const [
      academicAnalysis,
      kycAnalysis,
      financialAnalysis,
      cibilAnalysis, // ✅ NEW
      workExperienceAnalysis,
      admissionLetterAnalysis,
    ] = await Promise.allSettled([
      analyzeAcademicRecords({ studentData }),
      analyzeKYC({ studentData }),
      analyzeFinancials({ studentData }),
      analyzeCIBIL({ studentData }), // ✅ NEW
      analyzeWorkExperience({ studentData }),
      analyzeAdmissionLetter({ studentData }),
    ]).then((results) =>
      results.map((r, i) => {
        const labels = ["Academic", "KYC", "Financial", "CIBIL", "WorkExp", "Admission"];
        if (r.status === "fulfilled") {
          console.log(`✅ ${labels[i]} analysis completed`);
          return r.value;
        }
        console.error(`❌ ${labels[i]} analysis failed:`, r.reason?.message);
        return { score: 0, error: r.reason?.message };
      })
    );

    console.log("✅ All parallel analyses completed");

    // Build state for NBFC matching
    const state = {
      studentData,
      nbfcRequirements,
      academicAnalysis,
      kycAnalysis,
      financialAnalysis,
      cibilAnalysis, // ✅ NEW
      workExperienceAnalysis,
      admissionLetterAnalysis,
    };

    // NBFC matching (sequential after analyses)
    const { nbfcs, overallScore } = await matchNBFCEligibility(state);
    state.eligibleNBFCs = nbfcs;
    state.overallScore = overallScore;

    // Generate recommendations
    const recommendations = await generateOverallRecommendations(state);

    const eligibleCount = nbfcs.filter(
      (n) => n.eligibilityStatus === "eligible"
    ).length;

    console.log("✅ Analysis complete!");
    console.log(`📈 Overall Score: ${overallScore}/100`);
    console.log(`🏦 Eligible NBFCs: ${eligibleCount}`);

    return {
      studentData,
      nbfcRequirements,
      academicAnalysis,
      kycAnalysis,
      financialAnalysis,
      cibilAnalysis, // ✅ NEW
      workExperienceAnalysis,
      admissionLetterAnalysis,
      eligibleNBFCs: nbfcs,
      overallScore,
      recommendations: {
        academic: academicAnalysis.recommendations || [],
        kyc: kycAnalysis.recommendations || [],
        financial: financialAnalysis.recommendations || [],
        cibil: cibilAnalysis.recommendations || [], // ✅ NEW
        workExperience: workExperienceAnalysis.recommendations || [],
        admissionLetter: admissionLetterAnalysis.recommendations || [],
        overall: recommendations,
      },
    };
  } catch (error) {
    console.error("❌ Analysis error:", error.message);
    console.error("Error stack:", error.stack);
    throw new Error(`Loan analysis failed: ${error.message}`);
  }
}

module.exports = {
  analyzeStudentApplication,
};