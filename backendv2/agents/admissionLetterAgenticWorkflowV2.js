// agents/admissionLetterAgenticWorkflowV2.js - PRODUCTION-GRADE ADMISSION LETTER AGENT V2
// 🚀 Enhanced with multi-agent architecture, comprehensive validation, and improvement recommendations

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const config = require("../config/config");
const EventEmitter = require("events");

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
    this.callHistory = this.callHistory.filter((time) => now - time < 60000);

    if (this.callHistory.length >= this.maxCallsPerMinute) {
      const oldestCall = this.callHistory[0];
      const waitTime = 60000 - (now - oldestCall) + 1000;
      if (waitTime > 0) {
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelay) {
      const delay = this.minDelay - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastCallTime = Date.now();
    this.callHistory.push(this.lastCallTime);
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// AGENT POOL
// ============================================================================
class AgentPool extends EventEmitter {
  constructor() {
    super();
    this.gemini = null;
    this.groq = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    if (!config.ai.gemeniApiKey) {
      throw new Error("GEMENI_API_KEY missing in environment variables");
    }

    if (!config.ai.groqApiKey) {
      throw new Error("GROQ_API_KEY missing in environment variables");
    }

    // Gemini for vision + extraction
    this.gemini = new ChatGoogleGenerativeAI({
      apiKey: config.ai.gemeniApiKey,
      model: "gemini-2.5-flash",
      temperature: 0.1,
      maxOutputTokens: 4096,
      timeout: 60000,
    });

    // Groq for verification and risk analysis
    this.groq = new ChatGroq({
      apiKey: config.ai.groqApiKey,
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      maxTokens: 2048,
      timeout: 30000,
    });

    this.initialized = true;
    console.log("✅ Admission Letter Agent Pool initialized (Gemini + Groq)");
  }

  getGemini() {
    if (!this.initialized) throw new Error("Agent pool not initialized");
    return this.gemini;
  }

  getGroq() {
    if (!this.initialized) throw new Error("Agent pool not initialized");
    return this.groq;
  }
}

const agentPool = new AgentPool();

// ============================================================================
// BASE AGENT CLASS
// ============================================================================
class BaseAgent {
  static extractText(response) {
    if (typeof response === "string") return response;

    if (response?.content) {
      if (typeof response.content === "string") return response.content;
      if (Array.isArray(response.content)) {
        return response.content
          .map((part) => part.text || part.content || part)
          .filter(Boolean)
          .join("\n");
      }
      if (response.content.text) return response.content.text;
    }

    if (response?.text) return response.text;

    if (response?.kwargs?.content) {
      if (typeof response.kwargs.content === "string") {
        return response.kwargs.content;
      }
      if (Array.isArray(response.kwargs.content)) {
        return response.kwargs.content
          .map((part) => part?.text || part?.content || "")
          .filter(Boolean)
          .join("\n");
      }
    }

    return "";
  }

  static safeJsonParse(text, fallback = null, contextLabel = "Agent") {
    if (!text?.trim()) return fallback;

    let cleaned = text
      .trim()
      .replace(/```/g, "")
      .replace(/```javascript\s*/gi, "")
      .replace(/^[^{[}]*/, "")
      .replace(/[^}\]]*$/, "");

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const match = text.match(/[\[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match);
        } catch (err) {
          console.error(`❌ ${contextLabel} JSON parse failed:`, err.message);
        }
      }
      return fallback;
    }
  }

  static async retryWithBackoff(fn, maxRetries = 3, agentName = "Agent") {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await rateLimiter.waitIfNeeded();
        return await fn();
      } catch (error) {
        lastError = error;
        console.error(
          `❌ ${agentName} attempt ${i + 1}/${maxRetries} failed:`,
          error.message
        );

        if (
          error.status === 429 ||
          error.message?.toLowerCase().includes("rate limit")
        ) {
          const delay = Math.pow(2, i) * 7000;
          console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw (
      lastError || new Error(`${agentName} failed after ${maxRetries} retries`)
    );
  }
}

// ============================================================================
// SPECIALIZED ADMISSION LETTER AGENTS
// ============================================================================

// 1. EXTRACTION AGENT - Extract structured data from admission letter
class AdmissionExtractionAgent extends BaseAgent {
  static async extract(cloudinaryUrl, fileType) {
    console.log("🔍 Admission Extraction Agent analyzing document...");

    const currentYear = new Date().getFullYear();
    const prompt = `You are an expert at analyzing university admission and offer letters.

Analyze this ${fileType} admission/offer letter and extract structured information.

Document URL: ${cloudinaryUrl}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "universityName": "string (full official university name) or null",
  "programName": "string (complete program/course name with degree type) or null",
  "intakeTerm": "Fall|Spring|Summer|Winter or null",
  "intakeYear": number (4-digit year ${currentYear}-${currentYear + 5}) or null,
  "country": "string (full country name where university is located) or null",
  "city": "string (city where campus is located) or null",
  "degreeLevel": "Bachelor|Master|PhD|Diploma|Certificate or null",
  "duration": "string (program duration like '2 years', '4 years') or null",
  "tuitionFee": "string (annual or total tuition if mentioned) or null",
  "scholarshipMentioned": boolean,
  "documentsRequired": ["array of documents student needs to submit"],
  "deadlines": {
    "acceptanceDeadline": "string or null",
    "enrollmentDeadline": "string or null",
    "feePaymentDeadline": "string or null"
  },
  "extractionMetadata": {
    "documentQuality": "excellent|good|fair|poor",
    "fieldsExtracted": number,
    "confidence": number (0-100),
    "readabilityIssues": ["array of issues if any"]
  }
}

EXTRACTION RULES:
1. Extract text EXACTLY as shown on the document
2. Set fields to null if information is not clearly visible
3. scholarshipMentioned: true only if scholarship/financial aid is explicitly mentioned
4. documentsRequired: List only if explicitly mentioned (e.g., passport, transcripts, etc.)
5. Assess document quality based on clarity and completeness
6. Count how many non-null critical fields you extracted

Be thorough and accurate. If uncertain, use null.`;

    const client = agentPool.getGemini();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(
      async () => {
        const response = await client.invoke([message]);
        const text = this.extractText(response);
        const result = this.safeJsonParse(
          text,
          null,
          "AdmissionExtractionAgent"
        );

        if (!result) {
          throw new Error("Failed to parse extraction response");
        }

        // Validate minimum data extracted
        const extractedFields = Object.keys(result).filter(
          (key) =>
            key !== "extractionMetadata" &&
            key !== "deadlines" &&
            key !== "documentsRequired" &&
            result[key] !== null &&
            result[key] !== undefined
        );

        if (extractedFields.length === 0) {
          throw new Error("No data extracted from admission letter");
        }

        console.log(
          `✅ Extracted ${extractedFields.length} fields from admission letter`
        );
        return result;
      },
      3,
      "AdmissionExtractionAgent"
    );
  }
}

// 2. VALIDATION AGENT - Validate extracted data (EASIER)
class AdmissionValidationAgent extends BaseAgent {
  static async validate(extractedData) {
    console.log(
      "✅ Admission Validation Agent checking data integrity (lenient mode)..."
    );

    const currentYear = new Date().getFullYear();

    const prompt = `You are an admission document validation specialist.

Validate the extracted admission letter data for correctness and consistency.

Return ONLY valid JSON:

{
  "valid": boolean,
  "overallConfidence": "high|medium|low",
  "fieldValidation": {
    "universityName": {
      "valid": boolean,
      "issues": ["array of specific issues"]
    },
    "programName": {
      "valid": boolean,
      "issues": ["array of specific issues"]
    },
    "intakeYear": {
      "valid": boolean,
      "issues": ["array of specific issues"]
    },
    "country": {
      "valid": boolean,
      "issues": ["array of specific issues"]
    }
  },
  "documentAuthenticity": {
    "appearAuthentic": boolean,
    "redFlags": ["array of authenticity concerns"],
    "missingCriticalInfo": ["array of missing essential fields"]
  },
  "criticalIssues": ["array of blocking issues that prevent approval"],
  "warnings": ["array of non-blocking warnings"],
  "recommendations": ["array of suggestions to improve data quality"]
}

VALIDATION RULES (LENIENT):

1. Mark the document as VALID in most normal cases.
2. Consider it VALID if:
   - University name looks like a plausible institution name, AND
   - Program name looks like a plausible academic program, AND
   - Intake year is between ${currentYear - 1} and ${currentYear + 5}.
3. Treat missing or slightly inconsistent fields as WARNINGS, not critical issues.
4. Only mark valid = false if there are STRONG reasons:
   - Obvious forgery signs (nonsense names, contradictory data, impossible dates),
   - Or almost all key fields are missing (no university name AND no program name).
5. Use "criticalIssues" ONLY for clear blocking problems.
6. Otherwise, prefer:
   - valid = true,
   - issues listed under "warnings",
   - and recommendations on how to improve.

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Be forgiving and practical. Students will re-upload a better copy later if needed.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(
      async () => {
        const response = await client.invoke([message]);
        const text = this.extractText(response);
        const result = this.safeJsonParse(
          text,
          null,
          "AdmissionValidationAgent"
        );

        if (!result || typeof result.valid !== "boolean") {
          throw new Error("Invalid validation response");
        }

        console.log(
          `✅ Validation complete (lenient): ${
            result.valid ? "VALID" : "INVALID"
          } (${result.overallConfidence} confidence)`
        );

        return result;
      },
      3,
      "AdmissionValidationAgent"
    );
  }
}

// 3. RISK ASSESSMENT AGENT - Assess university and loan risk (EASIER)
class AdmissionRiskAssessmentAgent extends BaseAgent {
  static async assessRisk(extractedData, validationResult) {
    console.log(
      "🔐 Admission Risk Assessment Agent analyzing (lenient mode)..."
    );

    const prompt = `You are a university admission risk assessment specialist for education loan applications.

Perform a practical, LENIENT risk assessment of this admission letter for loan approval purposes.

Return ONLY valid JSON:

{
  "verified": boolean,
  "verificationLevel": "high|medium|low|failed",
  "universityScore": number (0-100),
  "riskLevel": "low|medium|high",
  "confidence": number (0-100),
  "reason": "detailed explanation",
  "universityReputation": {
    "isRecognized": boolean,
    "accreditationStatus": "accredited|questionable|unknown",
    "reputationNotes": "string"
  },
  "loanApprovalFactors": {
    "programViability": "strong|moderate|weak",
    "countryReputation": "favorable|neutral|concerning",
    "tuitionReasonable": "yes|no|unknown",
    "employabilityProspects": "high|medium|low"
  },
  "issuesFound": ["array of specific concerns or red flags"],
  "strengths": ["array of positive factors"],
  "nbfcRecommendations": ["specific tips for improving loan approval chances"]
}

RISK ASSESSMENT CRITERIA (LENIENT):

1. VERIFIED should be TRUE in most normal cases.
   - Set verified = false ONLY if there are STRONG red flags:
     * University clearly looks fake or very suspicious,
     * Or the letter obviously looks forged.
2. For normal or slightly unclear cases:
   - Keep verified = true,
   - Use riskLevel = "medium" instead of "high",
   - And list concerns under "issuesFound".
3. Use riskLevel:
   - "low"  => well-known or reasonable institution and program.
   - "medium" => limited info or some minor concerns, but acceptable.
   - "high" => ONLY for clearly problematic institutions or documents.
4. Score Guide:
   - 80-100: Low risk, strong case.
   - 60-79: Medium risk, but generally acceptable.
   - 40-59: Higher risk, still possible with extra docs.
   - 0-39: Very high risk, likely not acceptable.
5. Be PRACTICAL:
   - Prefer verified = true with medium risk instead of marking everything as not verified.
   - Students can be asked for more documents later.

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Result:
${JSON.stringify(validationResult, null, 2)}

Provide a balanced, realistic assessment.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(
      async () => {
        const response = await client.invoke([message]);
        const text = this.extractText(response);
        const result = this.safeJsonParse(
          text,
          null,
          "AdmissionRiskAssessmentAgent"
        );

        if (!result || typeof result.verified !== "boolean") {
          throw new Error("Invalid risk assessment response");
        }

        console.log(
          `✅ Risk assessment (lenient) complete: ${
            result.verified ? "VERIFIED" : "NOT VERIFIED"
          } (Score: ${result.universityScore}/100)`
        );

        return result;
      },
      3,
      "AdmissionRiskAssessmentAgent"
    );
  }
}

// 4. IMPROVEMENT RECOMMENDATION AGENT - Suggest improvements
class AdmissionImprovementAgent extends BaseAgent {
  static async generateRecommendations(
    extractedData,
    validationResult,
    riskAssessment
  ) {
    console.log("💡 Admission Improvement Agent generating recommendations...");

    const prompt = `You are an education loan application advisor specializing in admission letter requirements.

Analyze the admission letter data and provide ACTIONABLE recommendations to improve loan approval chances.

Return ONLY valid JSON:
{
  "improvementScore": number (0-100),
  "currentStrength": "excellent|strong|moderate|weak|poor",
  "immediateActions": [
    {
      "priority": number (1-10),
      "action": "specific action",
      "reason": "why this helps loan approval",
      "estimatedImpact": "high|medium|low",
      "estimatedTime": "X minutes/hours/days"
    }
  ],
  "documentQualityImprovements": [
    "Better quality scan/photo",
    "Ensure letterhead is visible",
    "etc."
  ],
  "additionalDocumentsSuggested": [
    "University accreditation certificate",
    "Course curriculum",
    "etc."
  ],
  "nbfcSpecificTips": [
    "This university is recognized by X NBFC",
    "Consider applying to Y NBFC for this program",
    "etc."
  ],
  "alternativeOptions": [
    "If this university is not recognized, consider...",
    "etc."
  ],
  "estimatedLoanApprovalChance": "high|medium|low",
  "estimatedTimeToReady": "X hours/days"
}

Current State:
- University: ${extractedData.universityName || "Unknown"}
- Country: ${extractedData.country || "Unknown"}
- Program: ${extractedData.programName || "Unknown"}
- Validation Status: ${validationResult.valid ? "Valid" : "Invalid"}
- Risk Level: ${riskAssessment.riskLevel || "Unknown"}
- University Score: ${riskAssessment.universityScore || 0}/100

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Issues:
${JSON.stringify(validationResult.criticalIssues, null, 2)}

Risk Issues:
${JSON.stringify(riskAssessment.issuesFound, null, 2)}

Provide specific, actionable steps to improve loan approval chances.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(
      async () => {
        const response = await client.invoke([message]);
        const text = this.extractText(response);
        const result = this.safeJsonParse(
          text,
          {
            improvementScore: 50,
            currentStrength: "moderate",
            immediateActions: [],
            documentQualityImprovements: [],
            additionalDocumentsSuggested: [],
            nbfcSpecificTips: [],
            alternativeOptions: [],
            estimatedLoanApprovalChance: "medium",
            estimatedTimeToReady: "1 day",
          },
          "AdmissionImprovementAgent"
        );

        console.log(
          `✅ Generated ${
            result.immediateActions?.length || 0
          } improvement recommendations`
        );
        return result;
      },
      3,
      "AdmissionImprovementAgent"
    );
  }
}

// ============================================================================
// ORCHESTRATOR - Main workflow coordinator
// ============================================================================
class AdmissionLetterWorkflowOrchestrator {
  static async processAdmissionLetter(cloudinaryUrl, fileType, options = {}) {
    const startTime = Date.now();
    const { maxRetries = 2, enableImprovements = true } = options;

    try {
      await agentPool.initialize();

      // Phase 1: Extraction
      console.log("📊 Phase 1: Extracting admission letter data...");
      const extractedData = await AdmissionExtractionAgent.extract(
        cloudinaryUrl,
        fileType
      );

      if (
        !extractedData ||
        Object.values(extractedData).filter(Boolean).length === 0
      ) {
        throw new Error("No data extracted from admission letter");
      }

      // Phase 2: Validation
      console.log("✅ Phase 2: Validating extracted data...");
      const validationResult = await AdmissionValidationAgent.validate(
        extractedData
      );

      // Phase 3: Risk Assessment
      console.log("🔐 Phase 3: Assessing admission and loan risk...");
      const riskAssessment = await AdmissionRiskAssessmentAgent.assessRisk(
        extractedData,
        validationResult
      );

      // Phase 4: Improvement Recommendations (optional)
      let improvementRecommendations = null;
      if (enableImprovements && riskAssessment.universityScore < 60) {
        console.log(
          "💡 Phase 4: Generating improvement recommendations (score < 60)..."
        );
        improvementRecommendations =
          await AdmissionImprovementAgent.generateRecommendations(
            extractedData,
            validationResult,
            riskAssessment
          );
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Admission Letter Workflow completed in ${duration}ms`);
      console.log(
        `   - University: ${extractedData.universityName || "Unknown"}`
      );
      console.log(`   - Program: ${extractedData.programName || "Unknown"}`);
      console.log(
        `   - Validation: ${validationResult.valid ? "PASS" : "FAIL"}`
      );
      console.log(
        `   - Risk Assessment: ${
          riskAssessment.verified ? "VERIFIED" : "NOT VERIFIED"
        }`
      );
      console.log(
        `   - University Score: ${riskAssessment.universityScore}/100`
      );

      return {
        extractedData,
        validationResult,
        riskAssessment,
        improvementRecommendations,
        metadata: {
          processingTime: duration,
          fileType,
          agentsUsed: enableImprovements ? 4 : 3,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ Admission Letter Workflow failed:", error.message);
      throw error;
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
async function processAdmissionLetterV2(cloudinaryUrl, fileType, options = {}) {
  return await AdmissionLetterWorkflowOrchestrator.processAdmissionLetter(
    cloudinaryUrl,
    fileType,
    options
  );
}

module.exports = {
  processAdmissionLetterV2,
  agentPool,
  AdmissionExtractionAgent,
  AdmissionValidationAgent,
  AdmissionRiskAssessmentAgent,
  AdmissionImprovementAgent,
};
