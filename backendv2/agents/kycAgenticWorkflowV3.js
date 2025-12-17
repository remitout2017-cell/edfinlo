"use strict";

const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const { z } = require("zod");
const config = require("../config/config");
// Reuse your existing LLM agents and pool
const {
  agentPool,
  KycExtractionAgent,
  KycValidationAgent,
  KycVerificationAgent,
  KycImprovementAgent,
} = require("./kycAgenticWorkflowV2");

// Optimize a single image file and return a Buffer
async function optimizeImage(filePath) {
  const stats = await fs.stat(filePath);

  // If already reasonably small, just return as-is
  if (stats.size <= 500 * 1024) {
    return fs.readFile(filePath);
  }

  // Resize + compress (same spirit as V2)
  const optimized = await sharp(filePath)
    .resize(2048, 2048, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);
  console.log(
    `📉 [KYC V3] Image optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
      optimized.length / 1024
    ).toFixed(0)}KB (${reduction}% reduction)`
  );

  return optimized;
}

// Convert uploaded file paths → Gemini-compatible image objects
async function prepareImagesForExtraction(filePaths) {
  if (!filePaths || typeof filePaths !== "object") {
    throw new Error("[KYC V3] Invalid filePaths input");
  }

  const entries = Object.entries(filePaths).filter(
    ([, fp]) => fp && typeof fp === "string"
  );

  console.log(`📸 [KYC V3] Preparing ${entries.length} images...`);

  const imagePromises = entries.map(async ([key, fp]) => {
    const absolutePath = path.resolve(fp);
    const buffer = await optimizeImage(absolutePath);

    if (buffer.length > 15 * 1024 * 1024) {
      throw new Error(
        `[KYC V3] Image too large after optimization: ${key} (${Math.round(
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
  console.log(`✅ [KYC V3] ${images.length} images prepared for extraction`);

  return images;
}

const ExtractedSchema = z
  .object({
    aadhaarNumber: z.string().nullable().optional(),
    aadhaarName: z.string().nullable().optional(),
    aadhaarDOB: z.string().nullable().optional(),
    aadhaarAddress: z.string().nullable().optional(),
    aadhaarGender: z.string().nullable().optional(),
    panNumber: z.string().nullable().optional(),
    panName: z.string().nullable().optional(),
    panDOB: z.string().nullable().optional(),
    panFatherName: z.string().nullable().optional(),
    passportNumber: z.string().nullable().optional(),
    passportName: z.string().nullable().optional(),
    passportDOB: z.string().nullable().optional(),
    passportIssueDate: z.string().nullable().optional(),
    passportExpiryDate: z.string().nullable().optional(),
    passportPlaceOfIssue: z.string().nullable().optional(),
    passportPlaceOfBirth: z.string().nullable().optional(),
    extractionMetadata: z
      .object({
        documentQuality: z.string().optional(),
        fieldsExtracted: z.number().optional(),
        documentsIdentified: z.array(z.string()).optional(),
        confidence: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

const ValidationSchema = z
  .object({
    valid: z.boolean(),
    overallConfidence: z.number().optional(),
  })
  .passthrough();

const VerificationSchema = z
  .object({
    verified: z.boolean(),
    verificationLevel: z.string().optional(),
    confidence: z.number().optional(),
  })
  .passthrough();

/**
 * ============================
 * RULE-BASED VALIDATION
 * ============================
 */

function basicRuleValidate(extractedData) {
  const issues = [];
  const aadhaarInfo = {
    valid: true,
    issues: [],
    confidence: 100,
  };
  const panInfo = {
    valid: true,
    issues: [],
    confidence: 100,
  };
  const passportInfo = {
    valid: true,
    issues: [],
    confidence: 100,
  };

  // Aadhaar: 12 digits
  if (extractedData.aadhaarNumber) {
    const digits = extractedData.aadhaarNumber.replace(/\D/g, "");
    if (!/^\d{12}$/.test(digits)) {
      aadhaarInfo.valid = false;
      aadhaarInfo.issues.push("Aadhaar must be exactly 12 digits.");
      aadhaarInfo.confidence = 40;
      issues.push("Invalid Aadhaar format.");
    }
  }

  // PAN: 5 letters + 4 digits + 1 letter
  if (extractedData.panNumber) {
    const pan = extractedData.panNumber.toUpperCase().trim();
    if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan)) {
      panInfo.valid = false;
      panInfo.issues.push("PAN must match pattern ABCDE1234F.");
      panInfo.confidence = 40;
      issues.push("Invalid PAN format.");
    }
  }

  // Passport: usually alphanumeric 8 chars (very loose)
  if (extractedData.passportNumber) {
    const pass = extractedData.passportNumber.toUpperCase().trim();
    if (!/^[A-Z0-9]{6,9}$/.test(pass)) {
      passportInfo.valid = false;
      passportInfo.issues.push("Passport format looks unusual.");
      passportInfo.confidence = 60;
      issues.push("Suspicious passport format.");
    }
  }

  const overallValid = issues.length === 0;
  const overallConfidence = overallValid ? 95 : 70;

  return {
    valid: overallValid,
    overallConfidence,
    fieldValidation: {
      aadhaar: aadhaarInfo,
      pan: panInfo,
      passport: passportInfo,
    },
    ruleIssues: issues,
  };
}

/**
 * ============================
 * ORCHESTRATOR V3
 * ============================
 */

class KycWorkflowOrchestratorV3 {
  static async processKycDocuments(filePaths, options = {}) {
    const startTime = Date.now();
    const { enableImprovements = true } = options;

    await agentPool.initialize();

    // Phase 1: Image processing
    console.log("📊 [KYC V3] Phase 1: Processing and preparing images...");
    const images = await prepareImagesForExtraction(filePaths);
    if (!images.length) {
      throw new Error("[KYC V3] No valid images provided");
    }

    // Phase 2: Extraction (Gemini)
    console.log("🔍 [KYC V3] Phase 2: Extracting KYC data...");
    const rawExtracted = await KycExtractionAgent.extract(images);

    if (!rawExtracted || !Object.values(rawExtracted).filter(Boolean).length) {
      throw new Error("[KYC V3] No data extracted from documents");
    }

    // Schema-soft-validate extraction
    const extractedParse = ExtractedSchema.safeParse(rawExtracted);
    if (!extractedParse.success) {
      console.warn(
        "⚠️ [KYC V3] Extracted data did not fully match schema:",
        extractedParse.error.issues?.map((i) => i.message).join(", ")
      );
    }
    const extractedData = extractedParse.success
      ? extractedParse.data
      : rawExtracted;

    // Local rule validation (free, deterministic)
    const ruleValidation = basicRuleValidate(extractedData);

    // Phase 3: Validation (Groq + rules)
    console.log("✅ [KYC V3] Phase 3: Validating extracted data...");
    const rawValidation = await KycValidationAgent.validate(extractedData);

    const validationParse = ValidationSchema.safeParse(rawValidation);
    const validationResult = validationParse.success
      ? validationParse.data
      : rawValidation || { valid: false };

    // Merge in rule-based checks
    validationResult.ruleValidation = ruleValidation;
    if (typeof validationResult.overallConfidence === "number") {
      validationResult.overallConfidence = Math.round(
        (validationResult.overallConfidence +
          ruleValidation.overallConfidence) /
          2
      );
    } else {
      validationResult.overallConfidence = ruleValidation.overallConfidence;
    }

    // Phase 4: Verification (Groq)
    console.log("🔐 [KYC V3] Phase 4: Verifying cross-document consistency...");
    const rawVerification = await KycVerificationAgent.verify(
      extractedData,
      validationResult
    );

    const verificationParse = VerificationSchema.safeParse(rawVerification);
    const verificationResult = verificationParse.success
      ? verificationParse.data
      : rawVerification || { verified: false };

    // Optional Phase 5: Improvements
    let improvementRecommendations = null;
    if (enableImprovements && !verificationResult.verified) {
      console.log(
        "💡 [KYC V3] Phase 5: Generating improvement recommendations..."
      );
      improvementRecommendations =
        await KycImprovementAgent.generateRecommendations(
          extractedData,
          validationResult,
          verificationResult
        );
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [KYC V3] Workflow completed in ${duration}ms`);
    console.log(
      `   - Documents processed: ${images.length}, fields extracted: ${
        extractedData.extractionMetadata?.fieldsExtracted || 0
      }`
    );
    console.log(
      `   - Validation: ${validationResult.valid ? "PASS" : "FAIL"} (rules: ${
        ruleValidation.valid ? "PASS" : "FAIL"
      })`
    );
    console.log(
      `   - Verification: ${
        verificationResult.verified ? "VERIFIED" : "NOT VERIFIED"
      } (${verificationResult.verificationLevel || "n/a"})`
    );

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
        version: "v3",
        env: config.env || "development",
      },
    };
  }
}

/**
 * ============================
 * PUBLIC API
 * ============================
 */

async function processKycDocumentsV3(filePaths, options = {}) {
  return KycWorkflowOrchestratorV3.processKycDocuments(filePaths, options);
}

module.exports = {
  processKycDocumentsV3,
};
