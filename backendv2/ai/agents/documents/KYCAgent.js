// KYC Document Agent using LangGraph
import { StateGraph, END } from "@langchain/langgraph";
import { BaseAgent } from "../../core/BaseAgent.js";
import { AI_MODELS } from "../../config/aiModels.js";

// KYC-specific state schema
const KYC_STATE_SCHEMA = {
  // Input
  images: [],
  options: {},

  // Extraction
  aadhaarData: null,
  panData: null,
  passportData: null,
  extractionComplete: false,

  // Validation
  validationResult: null,
  validationComplete: false,

  // Verification
  verificationResult: null,
  verified: false,

  // Metadata
  currentStep: "",
  errors: [],
  startTime: 0,
};

export class KYCAgent {
  constructor() {
    // Initialize extraction agent (Gemini primary)
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);

    // Initialize verification agent (Groq primary)
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);

    // Build workflow
    this.graph = this.buildKYCWorkflow();
    this.app = this.graph.compile();

    console.log("🪪 KYC Agent initialized with LangGraph");
  }

  buildKYCWorkflow() {
    const workflow = new StateGraph({
      channels: KYC_STATE_SCHEMA,
    });

    // Define nodes
    workflow.addNode("extract_documents", (state) =>
      this.extractDocuments(state)
    );
    workflow.addNode("validate_data", (state) => this.validateData(state));
    workflow.addNode("verify_consistency", (state) =>
      this.verifyConsistency(state)
    );
    workflow.addNode("generate_report", (state) => this.generateReport(state));
    workflow.addNode("handle_extraction_failure", (state) =>
      this.handleExtractionFailure(state)
    );

    // Set entry point
    workflow.setEntryPoint("extract_documents");

    // Define conditional edges
    workflow.addConditionalEdges(
      "extract_documents",
      (state) => {
        if (state.extractionComplete) return "validation";
        return "extraction_failed";
      },
      {
        validation: "validate_data",
        extraction_failed: "handle_extraction_failure",
      }
    );

    workflow.addConditionalEdges(
      "validate_data",
      (state) => {
        if (state.validationComplete) return "verification";
        return "end";
      },
      {
        verification: "verify_consistency",
        end: "generate_report",
      }
    );

    workflow.addEdge("verify_consistency", "generate_report");
    workflow.addEdge("generate_report", END);
    workflow.addEdge("handle_extraction_failure", END);

    return workflow;
  }

  // Node: Extract KYC Documents
  async extractDocuments(state) {
    console.log("🔍 Extracting KYC documents...");

    const prompt = this.getExtractionPrompt();

    try {
      // Try primary model (Gemini)
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        console.warn("⚠️ Primary extraction failed, trying fallback...");
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const extracted = this.extractionAgent.parseJSON(response.content);

      return {
        ...state,
        aadhaarData: extracted.aadhaar || null,
        panData: extracted.pan || null,
        passportData: extracted.passport || null,
        extractionComplete: true,
        currentStep: "extraction_complete",
      };
    } catch (error) {
      console.error("❌ Extraction failed:", error.message);

      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: "extraction", error: error.message }],
        currentStep: "extraction_failed",
      };
    }
  }

  // Node: Validate Extracted Data
  async validateData(state) {
    console.log("✅ Validating KYC data...");

    const { aadhaarData, panData, passportData } = state;

    // Rule-based validation
    const validation = {
      valid: true,
      issues: [],
    };

    // Validate Aadhaar (12 digits)
    if (aadhaarData?.aadhaarNumber) {
      const digits = aadhaarData.aadhaarNumber.replace(/\D/g, "");
      if (!/^\d{12}$/.test(digits)) {
        validation.valid = false;
        validation.issues.push("Invalid Aadhaar format");
      }
    }

    // Validate PAN (ABCDE1234F)
    if (panData?.panNumber) {
      const pan = panData.panNumber.toUpperCase();
      if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan)) {
        validation.valid = false;
        validation.issues.push("Invalid PAN format");
      }
    }

    return {
      ...state,
      validationResult: validation,
      validationComplete: true,
      currentStep: "validation_complete",
    };
  }

  // Node: Verify Cross-Document Consistency
  async verifyConsistency(state) {
    console.log("🔐 Verifying document consistency...");

    const { aadhaarData, panData, passportData, validationResult } = state;

    const prompt = this.getVerificationPrompt(
      aadhaarData,
      panData,
      passportData
    );

    try {
      // Try primary verification (Groq)
      let response;
      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn("⚠️ Primary verification failed, trying fallback...");
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);

      return {
        ...state,
        verificationResult: verification,
        verified: verification.verified || false,
        currentStep: "verification_complete",
      };
    } catch (error) {
      console.error("❌ Verification failed:", error.message);

      return {
        ...state,
        verificationResult: { verified: false, error: error.message },
        verified: false,
        errors: [
          ...state.errors,
          { step: "verification", error: error.message },
        ],
        currentStep: "verification_failed",
      };
    }
  }

  // Node: Generate Final Report
  async generateReport(state) {
    console.log("📊 Generating KYC report...");

    const processingTime = Date.now() - state.startTime;

    return {
      ...state,
      currentStep: "complete",
      metadata: {
        processingTime,
        extractionComplete: state.extractionComplete,
        validationComplete: state.validationComplete,
        verified: state.verified,
      },
    };
  }

  // Node: Handle Extraction Failure
  async handleExtractionFailure(state) {
    console.error("❌ KYC extraction failed completely");

    return {
      ...state,
      currentStep: "failed",
      extractionComplete: false,
    };
  }

  getExtractionPrompt() {
    return `Extract KYC document details from the provided images. Return ONLY valid JSON:

{
  "aadhaar": {
    "aadhaarNumber": "string (12 digits) or null",
    "name": "string or null",
    "dob": "YYYY-MM-DD or null",
    "address": "string or null",
    "gender": "Male|Female|Other or null"
  },
  "pan": {
    "panNumber": "string (ABCDE1234F) or null",
    "name": "string or null",
    "dob": "YYYY-MM-DD or null",
    "fatherName": "string or null"
  },
  "passport": {
    "passportNumber": "string or null",
    "name": "string or null",
    "dob": "YYYY-MM-DD or null",
    "issueDate": "YYYY-MM-DD or null",
    "expiryDate": "YYYY-MM-DD or null"
  }
}

RULES:
1. Extract exactly as shown on documents
2. Use null for missing fields
3. Dates must be YYYY-MM-DD format
4. Aadhaar: exactly 12 digits
5. PAN: 5 letters + 4 digits + 1 letter`;
  }

  getVerificationPrompt(aadhaarData, panData, passportData) {
    return `Verify KYC document consistency. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": 0-100,
  "nameMatches": true|false,
  "dobMatches": true|false,
  "issues": ["array of issues"],
  "recommendation": "approve|review|reject"
}

Data:
Aadhaar: ${JSON.stringify(aadhaarData)}
PAN: ${JSON.stringify(panData)}
Passport: ${JSON.stringify(passportData)}

Verify: Name consistency, DOB consistency, overall authenticity.`;
  }

  // Public API
  async processKYC(images, options = {}) {
    const initialState = {
      ...KYC_STATE_SCHEMA,
      images,
      options,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);

      return {
        success: result.extractionComplete && result.verified,
        aadhaar: result.aadhaarData,
        pan: result.panData,
        passport: result.passportData,
        validation: result.validationResult,
        verification: result.verificationResult,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error("❌ KYC workflow failed:", error);
      throw error;
    }
  }
}
