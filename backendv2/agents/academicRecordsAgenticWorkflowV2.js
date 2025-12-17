// agents/academicRecordsAgenticWorkflowV2.js - PRODUCTION-GRADE ACADEMIC AGENT V2
// 🚀 Enhanced with multi-agent architecture, comprehensive validation, and improvement recommendations

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
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
      maxOutputTokens: 3072,
      timeout: 60000,
    });

    // Groq for verification and validation
    this.groq = new ChatGroq({
      apiKey: config.ai.groqApiKey,
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      maxTokens: 2048,
      timeout: 30000,
    });

    this.initialized = true;
    console.log("✅ Academic Agent Pool initialized (Gemini + Groq)");
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
// IMAGE PROCESSING UTILITIES
// ============================================================================
class ImageProcessor {
  static async optimizeImage(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size <= 400 * 1024) {
        return await fs.readFile(filePath);
      }

      const optimized = await sharp(filePath)
        .resize(2048, 2048, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

      const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);
      console.log(
        `📉 Academic doc optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
          optimized.length / 1024
        ).toFixed(0)}KB (${reduction}% reduction)`
      );

      return optimized;
    } catch (error) {
      console.error(`❌ Image processing failed for ${filePath}:`, error.message);
      throw error;
    }
  }

  static async prepareImagesForExtraction(filePaths) {
    console.log(`📸 Preparing ${filePaths.length} academic document(s)...`);
    const imagePromises = filePaths
      .filter(fp => fp && typeof fp === "string")
      .map(async fp => {
        const buffer = await this.optimizeImage(fp);
        
        if (buffer.length > 15 * 1024 * 1024) {
          throw new Error(
            `Image too large after optimization: ${path.basename(fp)} (${Math.round(
              buffer.length / 1024 / 1024
            )}MB)`
          );
        }

        const mimeType = fp.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        return {
          type: "image_url",
          image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
        };
      });

    const images = await Promise.all(imagePromises);
    console.log(`✅ ${images.length} academic document(s) prepared`);
    return images;
  }
}

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
          .map(part => part?.text || part?.content || "")
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
      .replace(/```\s*/g, "")
      .replace(/^[^{[}]*/, "")
      .replace(/[^}\]]*$/, "");

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const match = text.match(/[\[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
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
        console.error(`❌ ${agentName} attempt ${i + 1}/${maxRetries} failed:`, error.message);
        
        if (error.status === 429 || error.message?.toLowerCase().includes("rate limit")) {
          const delay = Math.pow(2, i) * 7000;
          console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error(`${agentName} failed after ${maxRetries} retries`);
  }
}

// ============================================================================
// SPECIALIZED ACADEMIC AGENTS
// ============================================================================

// 1. EXTRACTION AGENT - Multi-document OCR with field validation
class AcademicExtractionAgent extends BaseAgent {
  static getPromptForEducationType(educationType) {
    const isSchool = educationType === "class10" || educationType === "class12";
    
    let fields = `{
  "institutionName": "string or null",
  "boardUniversity": "string or null",
  "yearOfPassing": "number (4 digits, e.g., 2020) or null",
  "percentage": "number (0-100, decimal allowed) or null",
  "cgpa": "number (0-10, decimal allowed) or null",
  "grade": "string (e.g., A+, First Class) or null"`;

    if (educationType === "class12") {
      fields += `,
  "stream": "string (Science/Commerce/Arts) or null"`;
    }

    if (!isSchool) {
      fields += `,
  "courseName": "string or null",
  "specialization": "string or null",
  "semester": "number or null",
  "division": "string (First/Second/Third Class or Distinction) or null"`;
    }

    fields += `,
  "extractionMetadata": {
    "documentQuality": "excellent|good|fair|poor",
    "fieldsExtracted": number,
    "confidence": number (0-100),
    "readabilityIssues": ["array of issues if any"]
  }
}`;

    return `You are an expert at extracting information from Indian academic documents (marksheets, transcripts, certificates).

Analyze the provided ${educationType} document(s) and extract ALL available information.

Return ONLY valid JSON (no markdown, no code blocks):
${fields}

EXTRACTION RULES:
1. Extract text EXACTLY as shown on the document
2. For percentage: Extract as decimal number (e.g., 85.5 not "85.5%")
3. For CGPA: Extract with decimals if shown (e.g., 8.75)
4. For year: Must be 4 digits between 1990-${new Date().getFullYear()}
5. For institution: May not be visible on Class 10/12 - use null if not found
6. For grade/division: Extract exactly as shown (e.g., "First Class with Distinction", "A+", "O")
7. Use null for any missing/unreadable field
8. Assess document quality and readability
9. Count how many non-null fields you extracted

Be thorough but accurate. If uncertain about a value, use null.`;
  }

  static async extract(images, educationType) {
    console.log(`🔍 Academic Extraction Agent analyzing ${educationType} document(s)...`);

    const prompt = this.getPromptForEducationType(educationType);
    const client = agentPool.getGemini();
    const message = new HumanMessage({
      content: [
        { type: "text", text: prompt },
        ...images.map(img => ({ type: "image_url", image_url: img.image_url }))
      ],
    });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, null, "AcademicExtractionAgent");

      if (!result) {
        throw new Error("Failed to parse extraction response");
      }

      // Validate minimum data extracted
      const extractedFields = Object.keys(result).filter(
        key => key !== "extractionMetadata" && result[key] !== null && result[key] !== undefined
      );

      if (extractedFields.length === 0) {
        throw new Error("No data extracted from document");
      }

      console.log(`✅ Extracted ${extractedFields.length} fields from ${educationType} document`);
      return result;
    }, 3, "AcademicExtractionAgent");
  }
}

// 2. VALIDATION AGENT - Field-level validation with Indian academic standards
class AcademicValidationAgent extends BaseAgent {
  static async validate(extractedData, educationType) {
    console.log(`✅ Academic Validation Agent checking ${educationType} data...`);

    const currentYear = new Date().getFullYear();
    const prompt = `You are an academic document validation specialist for Indian education system.

Validate the extracted ${educationType} data for correctness and consistency.

Return ONLY valid JSON:
{
  "valid": boolean,
  "overallConfidence": "high|medium|low",
  "fieldValidation": {
    "percentage": {
      "valid": boolean,
      "value": number or null,
      "issues": ["array of specific issues"]
    },
    "cgpa": {
      "valid": boolean,
      "value": number or null,
      "issues": ["array of specific issues"]
    },
    "yearOfPassing": {
      "valid": boolean,
      "value": number or null,
      "issues": ["array of specific issues"]
    },
    "boardUniversity": {
      "valid": boolean,
      "value": string or null,
      "issues": ["array of specific issues"]
    }
  },
  "criticalIssues": ["array of blocking issues that prevent approval"],
  "warnings": ["array of non-blocking warnings"],
  "recommendations": ["array of suggestions to improve data quality"]
}

VALIDATION RULES FOR INDIAN ACADEMICS:
1. Year of Passing: Must be between 1990-${currentYear}, not in future
2. Percentage: Must be 0-100 (Indian system)
3. CGPA: Must be 0-10 (Indian system uses 10-point scale)
4. Board/University: Common ones are CBSE, ICSE, State Boards, UGC-recognized universities
5. Grade: Common are A+/A/B/C or First Class/Second Class/Third Class/Distinction
6. Institution name optional for Class 10/12 (often not printed on marksheets)
7. At least 2 critical fields must be present (e.g., percentage + year OR cgpa + year)

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Education Type: ${educationType}

Analyze thoroughly. Mark as invalid only if there are critical data inconsistencies.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, null, "AcademicValidationAgent");

      if (!result || typeof result.valid !== "boolean") {
        throw new Error("Invalid validation response");
      }

      console.log(
        `✅ Validation complete: ${result.valid ? "VALID" : "INVALID"} (${result.overallConfidence} confidence)`
      );
      return result;
    }, 3, "AcademicValidationAgent");
  }
}

// 3. VERIFICATION AGENT - Cross-field consistency and completeness check
class AcademicVerificationAgent extends BaseAgent {
  static async verify(extractedData, validationResult, educationType) {
    console.log(`🔐 Academic Verification Agent performing final checks for ${educationType}...`);

    const prompt = `You are a final verification specialist for academic records.

Perform comprehensive verification of ${educationType} data.

Return ONLY valid JSON:
{
  "verified": boolean,
  "verificationLevel": "high|medium|low|failed",
  "confidence": number (0-100),
  "reason": "detailed explanation",
  "dataCompleteness": {
    "hasPercentageOrCGPA": boolean,
    "hasYear": boolean,
    "hasBoardOrUniversity": boolean,
    "hasInstitution": boolean,
    "missingCriticalFields": ["array of missing critical fields"]
  },
  "consistencyChecks": {
    "percentageCGPAConsistency": {
      "consistent": boolean,
      "reason": "explanation"
    },
    "gradeConsistency": {
      "consistent": boolean,
      "reason": "explanation"
    }
  },
  "complianceChecks": {
    "meetsMinimumRequirements": boolean,
    "readyForApproval": boolean,
    "requiredActions": ["array of actions needed for approval"]
  },
  "qualityAssessment": {
    "documentQuality": "excellent|good|fair|poor",
    "dataReliability": "high|medium|low",
    "manualReviewNeeded": boolean,
    "reviewReason": "string or null"
  }
}

VERIFICATION CRITERIA FOR ${educationType.toUpperCase()}:
1. Minimum requirement: At least percentage OR CGPA + year
2. For Class 10/12: Board name is important
3. For Higher Education: University/Institution name is critical
4. Percentage and CGPA should be consistent if both present (CGPA ≈ percentage/10)
5. Grade should match percentage range (e.g., 75%+ = First Class/Distinction)
6. Year must be logical (not future, reasonable past)

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Result:
${JSON.stringify(validationResult, null, 2)}

Make final decision on verification status. Be thorough but fair.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, null, "AcademicVerificationAgent");

      if (!result || typeof result.verified !== "boolean") {
        throw new Error("Invalid verification response");
      }

      console.log(
        `✅ Verification complete: ${result.verified ? "VERIFIED" : "NOT VERIFIED"} (${result.verificationLevel})`
      );
      return result;
    }, 3, "AcademicVerificationAgent");
  }
}

// 4. IMPROVEMENT RECOMMENDATION AGENT - Suggest how to improve academic profile
class AcademicImprovementAgent extends BaseAgent {
  static async generateRecommendations(extractedData, validationResult, verificationResult, educationType) {
    console.log(`💡 Academic Improvement Agent generating recommendations for ${educationType}...`);

    const prompt = `You are an academic profile improvement advisor for education loan applications.

Analyze the ${educationType} data and provide ACTIONABLE recommendations to improve loan eligibility.

Return ONLY valid JSON:
{
  "improvementScore": number (0-100),
  "currentAcademicStrength": "excellent|strong|moderate|weak|poor",
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
    "Ensure all corners visible",
    "etc."
  ],
  "missingDocumentSuggestions": [
    "Upload Class 10 marksheet if not done",
    "Add higher education transcripts",
    "etc."
  ],
  "academicStrengthening": {
    "highlightAchievements": ["What to emphasize"],
    "additionalCertificates": ["Relevant certifications that boost profile"],
    "scoringTips": ["How to present scores effectively"]
  },
  "nbfcSpecificTips": [
    "NBFCs prefer students with 60%+ in Class 12",
    "Having consistent academic record helps",
    "etc."
  ],
  "estimatedTimeToReady": "X minutes/hours/days"
}

Current State:
- Education Type: ${educationType}
- Extracted Fields: ${Object.keys(extractedData).filter(k => extractedData[k] !== null).length}
- Validation Status: ${validationResult.valid ? "Valid" : "Invalid"}
- Verification Status: ${verificationResult.verified ? "Verified" : "Not Verified"}
- Confidence: ${verificationResult.confidence}%

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Issues:
${JSON.stringify(validationResult.criticalIssues, null, 2)}

Provide specific, actionable steps to improve academic profile for loan approval.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, {
        improvementScore: 50,
        currentAcademicStrength: "moderate",
        immediateActions: [],
        documentQualityImprovements: [],
        missingDocumentSuggestions: [],
        academicStrengthening: {},
        nbfcSpecificTips: [],
        estimatedTimeToReady: "1 day"
      }, "AcademicImprovementAgent");

      console.log(
        `✅ Generated ${result.immediateActions?.length || 0} improvement recommendations`
      );
      return result;
    }, 3, "AcademicImprovementAgent");
  }
}

// ============================================================================
// ORCHESTRATOR - Main workflow coordinator
// ============================================================================
class AcademicWorkflowOrchestrator {
  static async processAcademicDocuments(filePaths, educationType, options = {}) {
    const startTime = Date.now();
    const { maxRetries = 2, enableImprovements = true } = options;

    try {
      await agentPool.initialize();

      // Phase 1: Image Processing
      console.log(`📊 Phase 1: Processing ${educationType} images...`);
      const images = await ImageProcessor.prepareImagesForExtraction(filePaths);

      if (images.length === 0) {
        throw new Error("No valid images provided");
      }

      // Phase 2: Extraction
      console.log(`🔍 Phase 2: Extracting ${educationType} data...`);
      const extractedData = await AcademicExtractionAgent.extract(images, educationType);

      if (!extractedData || Object.values(extractedData).filter(Boolean).length === 0) {
        throw new Error("No data extracted from documents");
      }

      // Phase 3: Validation
      console.log(`✅ Phase 3: Validating ${educationType} data...`);
      const validationResult = await AcademicValidationAgent.validate(extractedData, educationType);

      // Phase 4: Verification
      console.log(`🔐 Phase 4: Verifying ${educationType} consistency...`);
      const verificationResult = await AcademicVerificationAgent.verify(
        extractedData,
        validationResult,
        educationType
      );

      // Phase 5: Improvement Recommendations (optional)
      let improvementRecommendations = null;
      if (enableImprovements && (!verificationResult.verified || verificationResult.verificationLevel !== "high")) {
        console.log(`💡 Phase 5: Generating ${educationType} improvement recommendations...`);
        improvementRecommendations = await AcademicImprovementAgent.generateRecommendations(
          extractedData,
          validationResult,
          verificationResult,
          educationType
        );
      }

      const duration = Date.now() - startTime;
      console.log(`✅ ${educationType} Workflow completed in ${duration}ms`);
      console.log(`   - Documents processed: ${images.length}`);
      console.log(`   - Fields extracted: ${extractedData.extractionMetadata?.fieldsExtracted || 0}`);
      console.log(`   - Validation: ${validationResult.valid ? "PASS" : "FAIL"}`);
      console.log(`   - Verification: ${verificationResult.verified ? "VERIFIED" : "NOT VERIFIED"}`);

      return {
        extractedData,
        validationResult,
        verificationResult,
        improvementRecommendations,
        metadata: {
          processingTime: duration,
          documentsProcessed: images.length,
          educationType,
          agentsUsed: enableImprovements ? 4 : 3,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`❌ ${educationType} Workflow failed:`, error.message);
      throw error;
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
async function processAcademicDocumentsV2(filePaths, educationType, options = {}) {
  return await AcademicWorkflowOrchestrator.processAcademicDocuments(filePaths, educationType, options);
}

module.exports = {
  processAcademicDocumentsV2,
  agentPool,
  AcademicExtractionAgent,
  AcademicValidationAgent,
  AcademicVerificationAgent,
  AcademicImprovementAgent,
};
