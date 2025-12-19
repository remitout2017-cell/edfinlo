// agents/kycAgenticWorkflowV2.js - PRODUCTION-GRADE KYC AGENT V2
// 🚀 Enhanced with multi-agent architecture, rate limiting, and comprehensive validation

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
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
    this.minDelay = 2000; // 2s between calls
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
      model: "gemini-2.5-flash-lite",
      temperature: 0.1,
      maxOutputTokens: 4096,
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
    console.log("✅ KYC Agent Pool initialized (Gemini + Groq)");
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
      
      // If already small, use as-is
      if (stats.size <= 500 * 1024) {
        return await fs.readFile(filePath);
      }

      // Optimize large images
      const optimized = await sharp(filePath)
        .resize(2048, 2048, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();

      const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);
      console.log(
        `📉 Image optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
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
    console.log(`📸 Preparing ${Object.keys(filePaths).length} images...`);
    const imagePromises = Object.entries(filePaths)
      .filter(([, fp]) => fp && typeof fp === "string")
      .map(async ([key, fp]) => {
        const buffer = await this.optimizeImage(fp);
        
        if (buffer.length > 15 * 1024 * 1024) {
          throw new Error(
            `Image too large after optimization: ${key} (${Math.round(
              buffer.length / 1024 / 1024
            )}MB)`
          );
        }

        return {
          key,
          type: "image_url",
          image_url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
        };
      });

    const images = await Promise.all(imagePromises);
    console.log(`✅ ${images.length} images prepared for extraction`);
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
    }
    return response?.text || "";
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
// SPECIALIZED KYC AGENTS
// ============================================================================

// 1. EXTRACTION AGENT - Multi-document OCR with field validation
class KycExtractionAgent extends BaseAgent {
  static async extract(images) {
    console.log("🔍 KYC Extraction Agent analyzing documents...");

    const prompt = `You are an expert KYC document extractor for Indian identity documents. Extract ALL available data from the provided images.

Return ONLY valid JSON (no markdown):
{
  "aadhaarNumber": "string (12 digits) or null",
  "aadhaarName": "string or null",
  "aadhaarDOB": "YYYY-MM-DD or null",
  "aadhaarAddress": "string or null",
  "aadhaarGender": "Male|Female|Other or null",
  "panNumber": "string (format: ABCDE1234F) or null",
  "panName": "string or null",
  "panDOB": "YYYY-MM-DD or null",
  "panFatherName": "string or null",
  "passportNumber": "string or null",
  "passportName": "string or null",
  "passportDOB": "YYYY-MM-DD or null",
  "passportIssueDate": "YYYY-MM-DD or null",
  "passportExpiryDate": "YYYY-MM-DD or null",
  "passportPlaceOfIssue": "string or null",
  "passportPlaceOfBirth": "string or null",
  "extractionMetadata": {
    "documentQuality": "excellent|good|fair|poor",
    "fieldsExtracted": number,
    "documentsIdentified": ["Aadhaar Front", "Aadhaar Back", "PAN", "Passport"],
    "confidence": number (0-100)
  }
}

EXTRACTION RULES:
1. Extract text exactly as shown (preserve case and format)
2. For dates, convert to YYYY-MM-DD format
3. For Aadhaar, look for 12-digit number (may have spaces/dashes)
4. For PAN, look for format: ABCDE1234F
5. Handle both front and back of documents
6. Use null for missing/unreadable fields
7. Be case-sensitive for names

IMAGE ANALYSIS:
- Identify document type first (Aadhaar/PAN/Passport)
- Extract all visible text fields
- Cross-reference information across multiple images
- Note document quality and visibility issues`;

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
      const result = this.safeJsonParse(text, null, "KycExtractionAgent");

      if (!result) {
        throw new Error("Failed to parse extraction response");
      }

      console.log(`✅ Extracted ${result.extractionMetadata?.fieldsExtracted || 0} fields`);
      return result;
    }, 3, "KycExtractionAgent");
  }
}

// 2. VALIDATION AGENT - Field-level validation with Indian standards
class KycValidationAgent extends BaseAgent {
  static async validate(extractedData) {
    console.log("✅ KYC Validation Agent checking data integrity...");

    const prompt = `You are a KYC validation specialist for Indian identity documents. Validate the extracted data for correctness and consistency.

Return ONLY valid JSON:
{
  "valid": boolean,
  "overallConfidence": number (0-100),
  "fieldValidation": {
    "aadhaar": {
      "valid": boolean,
      "issues": ["array of issues"],
      "confidence": number
    },
    "pan": {
      "valid": boolean,
      "issues": ["array of issues"],
      "confidence": number
    },
    "passport": {
      "valid": boolean,
      "issues": ["array of issues"],
      "confidence": number
    }
  },
  "crossFieldValidation": {
    "nameConsistency": {
      "consistent": boolean,
      "variations": ["name variations found"],
      "reason": "explanation"
    },
    "dobConsistency": {
      "consistent": boolean,
      "dates": ["all DOBs found"],
      "reason": "explanation"
    }
  },
  "criticalIssues": ["array of blocking issues"],
  "warnings": ["array of non-blocking warnings"],
  "recommendations": ["array of suggestions to improve data"]
}

VALIDATION RULES:
1. Aadhaar: Must be exactly 12 digits, no letters
2. PAN: Must match format ABCDE1234F (5 letters + 4 digits + 1 letter)
3. Passport: Alphanumeric, typically 8 characters
4. Names: Check consistency across documents (allow minor variations)
5. DOB: Must be consistent across all documents
6. Dates: Must be valid calendar dates
7. Age: Must be logical (18-100 years for most documents)
8. Passport validity: Issue date < Expiry date

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Analyze thoroughly and provide detailed feedback.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, null, "KycValidationAgent");

      if (!result || typeof result.valid !== "boolean") {
        throw new Error("Invalid validation response");
      }

      console.log(
        `✅ Validation complete: ${result.valid ? "VALID" : "INVALID"} (${result.overallConfidence}% confidence)`
      );
      return result;
    }, 3, "KycValidationAgent");
  }
}

// 3. VERIFICATION AGENT - Cross-document consistency check
class KycVerificationAgent extends BaseAgent {
  static async verify(extractedData, validationResult) {
    console.log("🔐 KYC Verification Agent performing final checks...");

    const prompt = `You are a final verification specialist for KYC compliance. Perform comprehensive cross-document verification.

Return ONLY valid JSON:
{
  "verified": boolean,
  "verificationLevel": "high|medium|low|failed",
  "confidence": number (0-100),
  "reason": "detailed explanation",
  "documentCompleteness": {
    "hasAadhaar": boolean,
    "hasPAN": boolean,
    "hasPassport": boolean,
    "missingDocuments": ["array of missing docs"]
  },
  "identityConfirmation": {
    "nameMatches": boolean,
    "dobMatches": boolean,
    "allFieldsConsistent": boolean,
    "inconsistencies": ["array of mismatches"]
  },
  "complianceChecks": {
    "meetsMinimumRequirements": boolean,
    "readyForApproval": boolean,
    "requiredActions": ["array of actions needed"]
  },
  "riskAssessment": {
    "riskLevel": "low|medium|high",
    "riskFactors": ["array of risk indicators"],
    "recommendation": "approve|review|reject"
  }
}

VERIFICATION CRITERIA:
1. Minimum requirement: At least 2 valid documents
2. Name consistency: Max 1-2 word variations allowed
3. DOB: Must be identical across all documents
4. Document quality: Must be readable and authentic-looking
5. Field completeness: Critical fields must not be null

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Result:
${JSON.stringify(validationResult, null, 2)}

Make final decision on verification status.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, null, "KycVerificationAgent");

      if (!result || typeof result.verified !== "boolean") {
        throw new Error("Invalid verification response");
      }

      console.log(
        `✅ Verification complete: ${result.verified ? "VERIFIED" : "NOT VERIFIED"} (${result.verificationLevel})`
      );
      return result;
    }, 3, "KycVerificationAgent");
  }
}

// 4. IMPROVEMENT RECOMMENDATION AGENT - Suggest how to fix issues
class KycImprovementAgent extends BaseAgent {
  static async generateRecommendations(extractedData, validationResult, verificationResult) {
    console.log("💡 KYC Improvement Agent generating recommendations...");

    const prompt = `You are a KYC improvement advisor. Analyze the results and provide ACTIONABLE recommendations to improve KYC approval chances.

Return ONLY valid JSON:
{
  "improvementScore": number (0-100),
  "currentStatus": "excellent|good|needs_improvement|poor",
  "immediateActions": [
    {
      "priority": number (1-10),
      "action": "specific action",
      "reason": "why this helps",
      "estimatedImpact": "high|medium|low",
      "estimatedTime": "X minutes/hours"
    }
  ],
  "documentSpecificSuggestions": {
    "aadhaar": ["suggestion 1", "suggestion 2"],
    "pan": ["suggestion 1", "suggestion 2"],
    "passport": ["suggestion 1", "suggestion 2"]
  },
  "qualityImprovements": [
    "Better lighting for image capture",
    "Ensure all corners visible",
    "etc."
  ],
  "alternativeOptions": [
    "If PAN not available, use this alternative...",
    "etc."
  ],
  "estimatedTimeToReady": "X minutes/hours/days"
}

Current State:
- Extracted Fields: ${Object.values(extractedData).filter(Boolean).length}
- Validation Status: ${validationResult.valid ? "Valid" : "Invalid"}
- Verification Status: ${verificationResult.verified ? "Verified" : "Not Verified"}
- Confidence: ${verificationResult.confidence}%

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Validation Issues:
${JSON.stringify(validationResult.criticalIssues, null, 2)}

Provide specific, actionable steps to improve KYC completion.`;

    const client = agentPool.getGroq();
    const message = new HumanMessage({ content: prompt });

    return this.retryWithBackoff(async () => {
      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text, {
        improvementScore: 50,
        currentStatus: "needs_improvement",
        immediateActions: [],
        documentSpecificSuggestions: {},
        qualityImprovements: [],
        alternativeOptions: [],
        estimatedTimeToReady: "1 day"
      }, "KycImprovementAgent");

      console.log(
        `✅ Generated ${result.immediateActions?.length || 0} improvement recommendations`
      );
      return result;
    }, 3, "KycImprovementAgent");
  }
}

// ============================================================================
// ORCHESTRATOR - Main workflow coordinator
// ============================================================================
class KycWorkflowOrchestrator {
  static async processKycDocuments(filePaths, options = {}) {
    const startTime = Date.now();
    const { maxRetries = 2, enableImprovements = true } = options;

    try {
      await agentPool.initialize();

      // Phase 1: Image Processing
      console.log("📊 Phase 1: Processing and preparing images...");
      const images = await ImageProcessor.prepareImagesForExtraction(filePaths);

      if (images.length === 0) {
        throw new Error("No valid images provided");
      }

      // Phase 2: Extraction
      console.log("🔍 Phase 2: Extracting KYC data...");
      const extractedData = await KycExtractionAgent.extract(images);

      if (!extractedData || Object.values(extractedData).filter(Boolean).length === 0) {
        throw new Error("No data extracted from documents");
      }

      // Phase 3: Validation
      console.log("✅ Phase 3: Validating extracted data...");
      const validationResult = await KycValidationAgent.validate(extractedData);

      // Phase 4: Verification
      console.log("🔐 Phase 4: Verifying cross-document consistency...");
      const verificationResult = await KycVerificationAgent.verify(
        extractedData,
        validationResult
      );

      // Phase 5: Improvement Recommendations (optional)
      let improvementRecommendations = null;
      if (enableImprovements && !verificationResult.verified) {
        console.log("💡 Phase 5: Generating improvement recommendations...");
        improvementRecommendations = await KycImprovementAgent.generateRecommendations(
          extractedData,
          validationResult,
          verificationResult
        );
      }

      const duration = Date.now() - startTime;
      console.log(`✅ KYC Workflow completed in ${duration}ms`);
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
          imagesProcessed: images.length,
          agentsUsed: enableImprovements ? 4 : 3,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ KYC Workflow failed:", error.message);
      throw error;
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
async function processKycDocumentsV2(filePaths, options = {}) {
  return await KycWorkflowOrchestrator.processKycDocuments(filePaths, options);
}

module.exports = {
  processKycDocumentsV2,
  agentPool,
  KycExtractionAgent,
  KycValidationAgent,
  KycVerificationAgent,
  KycImprovementAgent,
};
