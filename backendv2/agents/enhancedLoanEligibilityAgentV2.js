// agents/enhancedLoanEligibilityAgentV2.js - FIXED VERSION

const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const config = require("../config/config");

// ============================================================================
// RATE LIMITER
// ============================================================================
class RateLimiter {
    constructor() {
        this.lastCallTime = 0;
        this.callHistory = [];
        this.minDelay = 2000;
        this.maxCallsPerMinute = 15;
    }

    async waitIfNeeded() {
        const now = Date.now();
        this.callHistory = this.callHistory.filter(time => now - time < 60000);

        if (this.callHistory.length >= this.maxCallsPerMinute) {
            const oldestCall = this.callHistory[0];
            const waitTime = 60000 - (now - oldestCall) + 1000;
            if (waitTime > 0) {
                console.log(`⏳ Rate limit protection: waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        const timeSinceLastCall = now - this.lastCallTime;
        if (timeSinceLastCall < this.minDelay) {
            const delay = this.minDelay - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastCallTime = Date.now();
        this.callHistory.push(this.lastCallTime);
    }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// AGENT POOL - FIXED CONFIG ACCESS
// ============================================================================
class AgentPool {
    constructor() {
        this.groq = null;
        this.gemini = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // FIXED: Access config.ai.groqApiKey instead of config.groqApiKey
        if (!config.ai.groqApiKey) {
            throw new Error("GROQ_API_KEY is missing in environment variables");
        }
        if (!config.ai.gemeniApiKey) {
            throw new Error("GEMENI_API_KEY is missing in environment variables");
        }

        this.groq = new ChatGroq({
            apiKey: config.ai.groqApiKey2, // FIXED
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            maxTokens: 3000,
            timeout: 45000,
        });

        this.gemini = new ChatGoogleGenerativeAI({
            apiKey: config.ai.gemeniApiKey,
            model: "gemini-2.5-flash-lite",
            temperature: 0.3,
            maxOutputTokens: 4096,
        });

        this.initialized = true;
        console.log("✅ Enhanced Agent Pool initialized");
    }

    getGroq() {
        if (!this.initialized) throw new Error("Agent pool not initialized");
        return this.groq;
    }

    getGemini() {
        if (!this.initialized) throw new Error("Agent pool not initialized");
        return this.gemini;
    }
}

const agentPool = new AgentPool();

// ============================================================================
// BASE AGENT WITH RETRY LOGIC - FIXED ERROR HANDLING
// ============================================================================
class BaseAgent {
    static safeJSONParse(raw, fallback, contextLabel) {
        try {
            if (!raw) return fallback;
            const text = typeof raw === "string" ? raw : String(raw);
            const start = text.indexOf("{");
            const end = text.lastIndexOf("}");

            if (start === -1 || end === -1 || end <= start) {
                console.warn(`⚠️ ${contextLabel}: no JSON found, using fallback`);
                return fallback;
            }

            const jsonSlice = text.slice(start, end + 1);
            return JSON.parse(jsonSlice);
        } catch (err) {
            console.error(`❌ ${contextLabel} parse error:`, err.message);
            return fallback;
        }
    }

    static async retryWithBackoff(fn, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                await rateLimiter.waitIfNeeded();
                return await fn();
            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${i + 1}/${maxRetries} failed:`, error.message);

                if (error.status === 429 && i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 7000;
                    console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else if (i < maxRetries - 1) {
                    // Regular retry with shorter delay
                    const delay = Math.pow(2, i) * 2000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        // FIXED: Properly throw error after all retries failed
        throw lastError || new Error("Operation failed after retries");
    }
}

// ============================================================================
// SPECIALIZED AGENTS
// ============================================================================

// 1. ACADEMIC IMPROVEMENT AGENT
class AcademicImprovementAgent extends BaseAgent {
    static async analyzeAndSuggest(academicData) {
        console.log("🎓 Academic Improvement Agent analyzing...");

        if (!academicData) {
            return {
                score: 0,
                strengths: [],
                weaknesses: ["No academic records found"],
                actionableSteps: [
                    "Upload Class 10 marksheet showing board and percentage",
                    "Upload Class 12 marksheet with stream details",
                    "Add higher education transcripts if applicable"
                ],
                impactAnalysis: {
                    potentialScoreIncrease: 25,
                    timeToComplete: "1-2 days",
                    priorityLevel: "CRITICAL"
                },
                nbfcSpecificTips: []
            };
        }

        const prompt = `You are an education loan advisor. Analyze academic records and provide ACTIONABLE improvement tips.

Return ONLY valid JSON:
{
  "score": <0-100>,
  "strengths": ["specific strengths"],
  "weaknesses": ["specific issues"],
  "actionableSteps": ["step 1 with exact action", "step 2"],
  "impactAnalysis": {
    "potentialScoreIncrease": <0-50>,
    "timeToComplete": "X days/weeks",
    "priorityLevel": "CRITICAL|HIGH|MEDIUM|LOW"
  },
  "nbfcSpecificTips": ["tip 1 for specific NBFCs"]
}

Academic Data:
- Class 10: ${academicData.class10?.percentage || "N/A"}% (${academicData.class10?.board || "N/A"})
- Class 12: ${academicData.class12?.percentage || "N/A"}% (${academicData.class12?.stream || "N/A"})
- Higher Education: ${academicData.higherEducation?.length || 0} entries

Focus on what's missing, how to improve, which NBFCs prefer strong academics.`;

        return this.retryWithBackoff(async () => {
            const client = agentPool.getGroq();
            const response = await client.invoke(prompt);
            return this.safeJSONParse(response.content, {
                score: 50,
                strengths: [],
                weaknesses: ["Analysis incomplete"],
                actionableSteps: ["Complete academic records"],
                impactAnalysis: { potentialScoreIncrease: 20, timeToComplete: "1 week", priorityLevel: "HIGH" },
                nbfcSpecificTips: []
            }, "AcademicImprovement");
        });
    }
}

// 2. FINANCIAL OPTIMIZATION AGENT
class FinancialOptimizationAgent extends BaseAgent {
    static async analyzeAndOptimize(coBorrowers = [], requestedAmount = 0) {
        console.log("💰 Financial Optimization Agent analyzing...");

        if (coBorrowers.length === 0) {
            return {
                score: 0,
                currentFinancialHealth: "NO_COBORROWER",
                optimizationSteps: [
                    "Add at least 1 co-borrower (parent/guardian preferred)",
                    "Co-borrower should have monthly income > ₹35,000",
                    "Ensure co-borrower has good credit score (700+)"
                ],
                foirRecommendations: {
                    currentFOIR: 0,
                    targetFOIR: 40,
                    howToReduce: ["Add co-borrower with no existing loans"]
                },
                loanAmountOptimization: {
                    currentEligibility: 0,
                    maxEligibility: 0,
                    howToIncrease: ["Add co-borrower earning ₹50,000+"]
                },
                specificActions: [
                    {
                        action: "Add primary co-borrower (parent)",
                        impact: "Increases eligibility by 80%",
                        urgency: "IMMEDIATE",
                        timeframe: "1 day"
                    }
                ],
                nbfcMatchImprovements: []
            };
        }

        const totalIncome = coBorrowers.reduce((sum, cb) => sum + (cb.grossMonthlyIncome || 0), 0);
        const totalEMI = coBorrowers.reduce((sum, cb) => sum + (cb.totalEmiAmount || 0), 0);
        const foir = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;

        const prompt = `Financial advisor for education loans. Provide SPECIFIC optimization strategies.

Return ONLY valid JSON:
{
  "score": <0-100>,
  "currentFinancialHealth": "EXCELLENT|GOOD|FAIR|POOR",
  "optimizationSteps": ["specific step 1", "step 2"],
  "foirRecommendations": {
    "currentFOIR": ${foir.toFixed(1)},
    "targetFOIR": <ideal value>,
    "howToReduce": ["action 1", "action 2"]
  },
  "loanAmountOptimization": {
    "currentEligibility": <amount>,
    "maxEligibility": <amount>,
    "howToIncrease": ["action 1", "action 2"]
  },
  "specificActions": [
    {
      "action": "clear description",
      "impact": "quantified impact",
      "urgency": "IMMEDIATE|HIGH|MEDIUM|LOW",
      "timeframe": "X days/weeks"
    }
  ],
  "nbfcMatchImprovements": ["which NBFCs you can now qualify for"]
}

Financial Data:
- Co-borrowers: ${coBorrowers.length}
- Total Monthly Income: ₹${totalIncome}
- Existing EMI: ₹${totalEMI}
- FOIR: ${foir.toFixed(1)}%
- Requested Loan: ₹${requestedAmount}

Provide FOIR optimization (target: <40%), income boosting strategies, EMI reduction tips.`;

        return this.retryWithBackoff(async () => {
            const client = agentPool.getGroq();
            const response = await client.invoke(prompt);
            return this.safeJSONParse(response.content, {
                score: 60,
                currentFinancialHealth: "FAIR",
                optimizationSteps: [],
                foirRecommendations: { currentFOIR: foir, targetFOIR: 40, howToReduce: [] },
                loanAmountOptimization: {
                    currentEligibility: totalIncome * 60,
                    maxEligibility: totalIncome * 80,
                    howToIncrease: []
                },
                specificActions: [],
                nbfcMatchImprovements: []
            }, "FinancialOptimization");
        });
    }
}

class NBFCMatchImprovementAgent extends BaseAgent {
    static async analyzeGapsAndSuggest(studentProfile, nbfcRequirements, currentMatches) {
        console.log("🏦 NBFC Match Improvement Agent analyzing...");

        const eligibleCount = currentMatches.filter(n => n.eligibilityStatus === "eligible").length;
        const borderlineCount = currentMatches.filter(n => n.eligibilityStatus === "borderline").length;
        const notEligibleCount = currentMatches.filter(n => n.eligibilityStatus === "not_eligible").length;

        // FIXED: Create detailed NBFC list with actual names and their requirements
        const nbfcDetailsList = currentMatches
            .filter(n => n.eligibilityStatus !== "eligible") // Focus on non-eligible ones
            .slice(0, 5) // Limit to top 5 for token efficiency
            .map((nbfc, index) => {
                const requirement = nbfcRequirements.find(r => r.nbfcId === nbfc.nbfcId);
                return `
NBFC: ${nbfc.nbfcName || `NBFC ${index + 1}`}
Status: ${nbfc.eligibilityStatus}
Requirements:
  - Min Income: ₹${requirement?.requirements?.minimumIncome || 25000}
  - Min Credit Score: ${requirement?.requirements?.minimumCreditScore || 650}
  - Max FOIR: ${requirement?.requirements?.maxFOIR || 50}%
  - Min Age: ${requirement?.requirements?.minAge || 18}
  - Max Age: ${requirement?.requirements?.maxAge || 65}`;
            }).join('\n\n');

        const prompt = `NBFC loan matching specialist. Analyze gaps and provide SPECIFIC actions to improve matches with REAL NBFC names.

Return ONLY valid JSON:
{
  "currentMatchSummary": {
    "eligible": ${eligibleCount},
    "borderline": ${borderlineCount},
    "notEligible": ${notEligibleCount}
  },
  "improvementRoadmap": [
    {
      "nbfcName": "EXACT NBFC NAME FROM LIST BELOW",
      "currentStatus": "borderline|not_eligible",
      "missingRequirements": ["specific requirement 1", "specific requirement 2"],
      "actionItems": [
        {
          "action": "specific action to meet requirement",
          "impactOnEligibility": "high|medium|low",
          "estimatedTime": "X days",
          "difficulty": "easy|medium|hard"
        }
      ],
      "potentialAfterImprovement": "eligible|borderline"
    }
  ],
  "quickWins": ["quick action 1 that helps multiple NBFCs", "quick action 2"],
  "longTermStrategies": ["strategy 1", "strategy 2"],
  "priorityActions": [
    {
      "action": "specific description",
      "benefitsNBFCs": ["Actual NBFC Name 1", "Actual NBFC Name 2"],
      "scoreImpact": <0-100>
    }
  ]
}

Student Profile:
- Overall Score: ${studentProfile.overallScore || 0}/100
- Academic Score: ${studentProfile.academicScore || 0}/100
- KYC: ${studentProfile.kycVerified ? "Verified" : "Not Verified"}
- Co-borrowers: ${studentProfile.coBorrowerCount || 0}
- Monthly Income: ₹${studentProfile.totalIncome || 0}
- FOIR: ${studentProfile.foir || 0}%

AVAILABLE NBFCs AND THEIR REQUIREMENTS:
${nbfcDetailsList}

Total NBFCs: ${nbfcRequirements.length}
Currently Eligible: ${eligibleCount}
Borderline: ${borderlineCount}
Not Eligible: ${notEligibleCount}

IMPORTANT: 
1. Use EXACT NBFC names from the list above
2. For each NBFC in improvementRoadmap, specify EXACTLY what requirements they're missing
3. Provide SPECIFIC actions for each missing requirement
4. Focus on borderline NBFCs first (easier to convert to eligible)
5. If student profile has gaps (no co-borrower, low income), mention that first

Provide steps to convert borderline → eligible and not_eligible → borderline.`;

        return this.retryWithBackoff(async () => {
            const client = agentPool.getGroq();
            const response = await client.invoke(prompt);

            const parsed = this.safeJSONParse(response.content, {
                currentMatchSummary: { eligible: eligibleCount, borderline: borderlineCount, notEligible: notEligibleCount },
                improvementRoadmap: [],
                quickWins: [],
                longTermStrategies: [],
                priorityActions: []
            }, "NBFCMatchImprovement");

            // ADDITIONAL FIX: If AI still generates generic names, replace with actual NBFC names
            if (parsed.improvementRoadmap && parsed.improvementRoadmap.length > 0) {
                parsed.improvementRoadmap = parsed.improvementRoadmap.map((item, index) => {
                    // Check if name is generic like "NBFC 1", "NBFC 2"
                    if (item.nbfcName && /^NBFC\s*\d+$/i.test(item.nbfcName)) {
                        // Replace with actual NBFC name from currentMatches
                        const actualNBFC = currentMatches.filter(n => n.eligibilityStatus !== "eligible")[index];
                        if (actualNBFC) {
                            item.nbfcName = actualNBFC.nbfcName;
                        }
                    }
                    return item;
                });
            }

            // Fix benefitsNBFCs in priorityActions
            if (parsed.priorityActions && parsed.priorityActions.length > 0) {
                parsed.priorityActions = parsed.priorityActions.map(action => {
                    if (action.benefitsNBFCs && action.benefitsNBFCs.length > 0) {
                        action.benefitsNBFCs = action.benefitsNBFCs.map((name, idx) => {
                            if (/^NBFC\s*\d+$/i.test(name)) {
                                const actualNBFC = currentMatches[idx];
                                return actualNBFC ? actualNBFC.nbfcName : name;
                            }
                            return name;
                        });
                    }
                    return action;
                });
            }

            return parsed;
        });
    }
}

// 4. DOCUMENT COMPLETENESS AGENT
class DocumentCompletenessAgent extends BaseAgent {
    static async analyzeDocumentGaps(studentData) {
        console.log("📄 Document Completeness Agent analyzing...");

        const prompt = `Document verification specialist. Analyze missing/incomplete documents.

Return ONLY valid JSON:
{
  "completenessScore": <0-100>,
  "missingDocuments": [
    {
      "documentType": "name",
      "criticality": "CRITICAL|HIGH|MEDIUM|LOW",
      "reason": "why needed",
      "whereToGet": "instructions",
      "formatRequired": "PDF/JPG",
      "impactOnApproval": "high|medium|low"
    }
  ],
  "incompleteDocuments": [
    {
      "documentType": "name",
      "issue": "what's wrong",
      "howToFix": "specific fix",
      "urgency": "immediate|high|medium"
    }
  ],
  "qualityImprovements": ["tip 1"],
  "estimatedTimeToComplete": "X days"
}

Current Documents:
- KYC: ${studentData.kycStatus}
- Academic Records: ${studentData.academicRecords ? "Present" : "Missing"}
- Admission Letter: ${studentData.admissionLetter ? "Present" : "Missing"}
- Co-borrower Docs: ${studentData.coBorrowers?.length || 0} sets
- Work Experience: ${studentData.workExperience?.length || 0} entries`;

        return this.retryWithBackoff(async () => {
            const client = agentPool.getGroq();
            const response = await client.invoke(prompt);
            return this.safeJSONParse(response.content, {
                completenessScore: 50,
                missingDocuments: [],
                incompleteDocuments: [],
                qualityImprovements: [],
                estimatedTimeToComplete: "1 week"
            }, "DocumentCompleteness");
        });
    }
}

// 5. MASTER RECOMMENDATION ORCHESTRATOR
class RecommendationOrchestrator extends BaseAgent {
    static async generateComprehensiveRecommendations(analysisResults) {
        console.log("🎯 Master Recommendation Orchestrator synthesizing...");

        const { academic, financial, nbfcMatch, documents, overallScore } = analysisResults;

        const prompt = `Master loan advisor. Create PRIORITIZED, ACTIONABLE plan.

Return ONLY valid JSON:
{
  "overallAssessment": {
    "currentReadiness": "READY|ALMOST_READY|NEEDS_WORK|NOT_READY",
    "estimatedApprovalChance": <0-100>,
    "timeToReady": "X days/weeks"
  },
  "immediateActions": [
    {
      "priority": 1,
      "action": "specific action",
      "why": "impact explanation",
      "how": "step-by-step",
      "scoreImpact": <0-100>,
      "estimatedTime": "X hours/days"
    }
  ],
  "shortTermGoals": ["goal 1 (1-2 weeks)"],
  "mediumTermGoals": ["goal 1 (2-4 weeks)"],
  "targetNBFCs": [
    {
      "nbfcName": "name",
      "matchProbability": "high|medium|low",
      "whatYouNeed": ["requirement 1"],
      "estimatedROI": "X-Y%"
    }
  ],
  "weeklyPlan": {
    "week1": ["task 1", "task 2"],
    "week2": ["task 1", "task 2"]
  },
  "expectedOutcomes": {
    "if1WeekWork": "outcome",
    "if2WeeksWork": "outcome",
    "if1MonthWork": "outcome"
  }
}

Analysis Summary:
- Overall Score: ${overallScore}/100
- Academic: ${academic?.score || 0}/100
- Financial: ${financial?.score || 0}/100
- Eligible NBFCs: ${nbfcMatch?.currentMatchSummary?.eligible || 0}
- Document Score: ${documents?.completenessScore || 0}/100`;

        return this.retryWithBackoff(async () => {
            const client = agentPool.getGroq();
            const response = await client.invoke(prompt);
            return this.safeJSONParse(response.content, {
                overallAssessment: {
                    currentReadiness: "NEEDS_WORK",
                    estimatedApprovalChance: 50,
                    timeToReady: "2 weeks"
                },
                immediateActions: [],
                shortTermGoals: [],
                mediumTermGoals: [],
                targetNBFCs: [],
                weeklyPlan: {},
                expectedOutcomes: {}
            }, "MasterRecommendation");
        });
    }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================
async function analyzeStudentApplicationEnhanced(studentData, nbfcRequirements) {
    console.log("🚀 Starting ENHANCED multi-agent loan eligibility analysis...");

    try {
        await agentPool.initialize();

        // Phase 1: Basic Analysis (Parallel)
        console.log("📊 Phase 1: Running specialized agent analyses...");
        const [academicAnalysis, financialAnalysis, documentAnalysis] = await Promise.all([
            AcademicImprovementAgent.analyzeAndSuggest(studentData.academicRecords),
            FinancialOptimizationAgent.analyzeAndOptimize(
                studentData.coBorrowers,
                studentData.requestedLoanAmount || 1000000
            ),
            DocumentCompletenessAgent.analyzeDocumentGaps(studentData)
        ]);

        // Calculate overall score
        const overallScore = Math.round(
            (academicAnalysis.score * 0.3) +
            (financialAnalysis.score * 0.4) +
            (documentAnalysis.completenessScore * 0.3)
        );

        // Phase 2: NBFC Matching (Sequential)
        console.log("🏦 Phase 2: Analyzing NBFC matches...");
        const currentMatches = nbfcRequirements.map(nbfc => ({
            nbfcId: nbfc.nbfcId,
            nbfcName: nbfc.nbfcName,
            eligibilityStatus: overallScore >= 70 ? "eligible" : overallScore >= 50 ? "borderline" : "not_eligible",
            matchPercentage: overallScore
        }));

        const nbfcMatchAnalysis = await NBFCMatchImprovementAgent.analyzeGapsAndSuggest(
            {
                overallScore,
                academicScore: academicAnalysis.score,
                kycVerified: studentData.kycStatus === "verified",
                coBorrowerCount: studentData.coBorrowers?.length || 0,
                totalIncome: studentData.coBorrowers?.reduce((sum, cb) => sum + (cb.grossMonthlyIncome || 0), 0) || 0,
                foir: financialAnalysis.foirRecommendations?.currentFOIR || 0
            },
            nbfcRequirements,
            currentMatches
        );

        // Phase 3: Master Recommendations
        console.log("🎯 Phase 3: Generating comprehensive recommendations...");
        const masterRecommendations = await RecommendationOrchestrator.generateComprehensiveRecommendations({
            academic: academicAnalysis,
            financial: financialAnalysis,
            nbfcMatch: nbfcMatchAnalysis,
            documents: documentAnalysis,
            overallScore
        });

        console.log("✅ Enhanced analysis complete!");
        console.log(`📈 Overall Score: ${overallScore}/100`);
        console.log(`🎯 Immediate Actions: ${masterRecommendations.immediateActions?.length || 0}`);

        return {
            overallScore,
            detailedAnalysis: {
                academic: academicAnalysis,
                financial: financialAnalysis,
                documents: documentAnalysis,
                nbfcMatching: nbfcMatchAnalysis
            },
            masterRecommendations,
            eligibleNBFCs: currentMatches.filter(n => n.eligibilityStatus === "eligible"),
            improvementPotential: {
                maxPossibleScore: 100,
                currentScore: overallScore,
                potentialIncrease: Math.max(0, 90 - overallScore),
                estimatedTimeframe: masterRecommendations.overallAssessment?.timeToReady || "2-3 weeks"
            }
        };

    } catch (error) {
        console.error("❌ Enhanced analysis error:", error);
        console.error("Error stack:", error.stack);
        throw new Error(`Enhanced loan analysis failed: ${error.message}`);
    }
}

module.exports = {
    analyzeStudentApplicationEnhanced,
    agentPool
};
