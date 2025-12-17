// ai/agents/documents/WorkExperienceAgent.js

import { StateGraph, END } from "@langchain/langgraph";
import { BaseAgent } from "../../core/BaseAgent.js";
import { AI_MODELS } from "../../config/aiModels.js";

const WORK_EXPERIENCE_STATE_SCHEMA = {
  images: [],
  workExperiences: [],
  extractionComplete: false,
  validationComplete: false,
  verificationComplete: false,
  currentStep: "",
  errors: [],
  startTime: 0,
};

export class WorkExperienceAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.verificationFallback = new BaseAgent(AI_MODELS.VERIFICATION_FALLBACK);
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    console.log("💼 Work Experience Agent initialized");
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: WORK_EXPERIENCE_STATE_SCHEMA,
    });

    workflow.addNode("extract_work_documents", (state) =>
      this.extractWorkDocuments(state)
    );
    workflow.addNode("parse_employment_details", (state) =>
      this.parseEmploymentDetails(state)
    );
    workflow.addNode("validate_dates", (state) => this.validateDates(state));
    workflow.addNode("calculate_experience", (state) =>
      this.calculateExperience(state)
    );
    workflow.addNode("verify_employment", (state) =>
      this.verifyEmployment(state)
    );
    workflow.addNode("generate_report", (state) => this.generateReport(state));

    workflow.setEntryPoint("extract_work_documents");

    workflow.addConditionalEdges(
      "extract_work_documents",
      (state) => (state.extractionComplete ? "parse" : "end"),
      {
        parse: "parse_employment_details",
        end: "generate_report",
      }
    );

    workflow.addEdge("parse_employment_details", "validate_dates");
    workflow.addEdge("validate_dates", "calculate_experience");
    workflow.addEdge("calculate_experience", "verify_employment");
    workflow.addEdge("verify_employment", "generate_report");
    workflow.addEdge("generate_report", END);

    return workflow;
  }
  async extractWorkDocuments(state) {
    console.log("💼 Extracting work experience documents...");

    const prompt = `Extract work experience from the document. Return ONLY valid JSON:

{
  "documents": [
    {
      "documentType": "experience_letter",
      "companyName": "string",
      "designation": "string",
      "startDate": "DD/MM/YYYY",
      "endDate": "DD/MM/YYYY or null",
      "currentlyWorking": true|false,
      "salary": {
        "amount": number or null,
        "currency": "INR"
      },
      "employmentType": "full_time",
      "confidence": 80
    }
  ]
}

If no clear work experience data found, return: {"documents": []}`;

    try {
      let response;

      const extractionPromise = this.extractionAgent.invoke(
        prompt,
        state.images
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Extraction timeout after 30s")),
          30000
        )
      );

      try {
        response = await Promise.race([extractionPromise, timeoutPromise]);
      } catch (error) {
        console.warn("⚠️ Primary extraction failed, using fallback...");

        const fallbackPromise = this.extractionFallback.invoke(
          prompt,
          state.images
        );
        const fallbackTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Fallback timeout after 30s")),
            30000
          )
        );

        response = await Promise.race([fallbackPromise, fallbackTimeout]);
      }

      // ✅ ADD DEBUG LOGGING
      console.log("🔍 Raw AI Response:", response.content?.substring(0, 500));

      let extracted;
      try {
        extracted = this.extractionAgent.parseJSON(response.content);
        console.log("✅ Parsed JSON:", JSON.stringify(extracted, null, 2));
      } catch (parseError) {
        console.error("❌ JSON Parse Error:", parseError.message);
        console.error("📄 Failed content:", response.content);

        // ✅ TRY MANUAL JSON EXTRACTION
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extracted = JSON.parse(jsonMatch[0]);
            console.log("✅ Manually extracted JSON:", extracted);
          } catch (e) {
            console.error("❌ Manual extraction also failed");
          }
        }
      }

      if (
        !extracted ||
        !extracted.documents ||
        extracted.documents.length === 0
      ) {
        console.warn("⚠️ No work experience data in extracted JSON");
        console.warn("📋 Extracted object:", extracted);

        return {
          ...state,
          workExperiences: [],
          extractionComplete: false,
          currentStep: "extraction_failed",
          errors: [
            ...state.errors,
            { step: "extraction", error: "No data extracted from document" },
          ],
        };
      }

      console.log(
        `✅ Extracted ${extracted.documents.length} work experience(s)`
      );

      return {
        ...state,
        workExperiences: extracted.documents,
        extractionComplete: true,
        currentStep: "extraction_complete",
      };
    } catch (error) {
      console.error("❌ Work experience extraction failed:", error.message);
      console.error("Stack:", error.stack);
      return {
        ...state,
        extractionComplete: false,
        workExperiences: [],
        errors: [...state.errors, { step: "extraction", error: error.message }],
        currentStep: "extraction_failed",
      };
    }
  }

  async parseEmploymentDetails(state) {
    console.log("📋 Parsing employment details...");
    const { workExperiences } = state;

    // Group documents by company
    const companiesMap = {};

    workExperiences.forEach((doc) => {
      const companyKey = doc.companyName?.toLowerCase().trim();
      if (!companyKey) return;

      if (!companiesMap[companyKey]) {
        companiesMap[companyKey] = {
          companyName: doc.companyName,
          documents: [],
        };
      }

      companiesMap[companyKey].documents.push(doc);
    });

    // Consolidate information per company
    const consolidatedExperiences = Object.values(companiesMap).map(
      (company) => {
        const allDocs = company.documents;

        // Priority: Experience Letter > Relieving Letter > Offer Letter
        const priorityDoc =
          allDocs.find((d) => d.documentType === "experience_letter") ||
          allDocs.find((d) => d.documentType === "relieving_letter") ||
          allDocs.find((d) => d.documentType === "offer_letter") ||
          allDocs[0];

        // Get earliest start date and latest end date
        const startDates = allDocs
          .map((d) => d.startDate || d.joiningDate)
          .filter(Boolean);
        const endDates = allDocs
          .map((d) => d.endDate || d.relievingDate)
          .filter(Boolean);

        const earliestStart =
          startDates.length > 0 ? this.getEarliestDate(startDates) : null;
        const latestEnd =
          endDates.length > 0 ? this.getLatestDate(endDates) : null;

        const currentlyWorking = allDocs.some(
          (d) => d.currentlyWorking === true
        );

        return {
          companyName: priorityDoc.companyName,
          primaryDesignation: priorityDoc.designation,
          designation: priorityDoc.designation,
          department: priorityDoc.department,
          employmentType: priorityDoc.employmentType || "full_time",
          startDate: earliestStart,
          endDate: currentlyWorking ? null : latestEnd,
          currentlyWorking,
          salary: priorityDoc.salary,
          isPaid: priorityDoc.isPaid !== false,
          responsibilities: priorityDoc.responsibilities || [],
          documentsProvided: allDocs.map((d) => d.documentType),
          confidence: Math.max(...allDocs.map((d) => d.confidence || 0)),
        };
      }
    );

    return {
      ...state,
      workExperiences: consolidatedExperiences,
      currentStep: "details_parsed",
    };
  }

  async validateDates(state) {
    console.log("📅 Validating employment dates...");
    const { workExperiences } = state;

    const validations = {
      valid: true,
      issues: [],
    };

    workExperiences.forEach((exp, index) => {
      exp.dateValidation = {
        valid: true,
        issues: [],
      };

      // Validate start date
      if (!exp.startDate) {
        exp.dateValidation.valid = false;
        exp.dateValidation.issues.push("Missing start date");
        validations.valid = false;
        validations.issues.push(
          `Experience ${index + 1} (${exp.companyName}): Missing start date`
        );
      }

      // Validate end date logic
      if (!exp.currentlyWorking && !exp.endDate) {
        exp.dateValidation.issues.push("End date missing for past employment");
        validations.issues.push(
          `Experience ${index + 1} (${exp.companyName}): End date missing`
        );
      }

      if (exp.currentlyWorking && exp.endDate) {
        exp.dateValidation.issues.push(
          "End date present but marked as currently working"
        );
      }

      // Validate date range
      if (exp.startDate && exp.endDate) {
        const start = this.parseDate(exp.startDate);
        const end = this.parseDate(exp.endDate);

        if (start && end && start > end) {
          exp.dateValidation.valid = false;
          exp.dateValidation.issues.push("Start date is after end date");
          validations.valid = false;
          validations.issues.push(
            `Experience ${index + 1} (${exp.companyName}): Invalid date range`
          );
        }
      }

      // Validate dates are not in future
      const today = new Date();
      if (exp.startDate) {
        const start = this.parseDate(exp.startDate);
        if (start && start > today) {
          exp.dateValidation.valid = false;
          exp.dateValidation.issues.push("Start date is in the future");
          validations.valid = false;
        }
      }
    });

    return {
      ...state,
      workExperiences,
      validationComplete: true,
      currentStep: "dates_validated",
      overallValidation: validations,
    };
  }

  async calculateExperience(state) {
    console.log("🧮 Calculating total work experience...");
    const { workExperiences } = state;

    workExperiences.forEach((exp) => {
      if (!exp.startDate) {
        exp.durationMonths = 0;
        exp.durationYears = 0;
        return;
      }

      const start = this.parseDate(exp.startDate);
      const end = exp.endDate ? this.parseDate(exp.endDate) : new Date();

      if (!start) {
        exp.durationMonths = 0;
        exp.durationYears = 0;
        return;
      }

      const months = this.calculateMonthsDifference(start, end);
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;

      exp.durationMonths = months;
      exp.durationYears = years;
      exp.durationDisplay =
        years > 0
          ? `${years} year${years > 1 ? "s" : ""} ${
              remainingMonths > 0
                ? `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
                : ""
            }`
          : `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`;
    });

    // Calculate total experience
    const totalMonths = workExperiences.reduce(
      (sum, exp) => sum + (exp.durationMonths || 0),
      0
    );
    const totalYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    const experienceSummary = {
      totalMonths,
      totalYears,
      totalDisplay:
        totalYears > 0
          ? `${totalYears} year${totalYears > 1 ? "s" : ""} ${
              remainingMonths > 0
                ? `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`
                : ""
            }`
          : `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`,
      numberOfEmployers: workExperiences.length,
      currentlyEmployed: workExperiences.some((exp) => exp.currentlyWorking),
      paidExperiences: workExperiences.filter((exp) => exp.isPaid).length,
      unpaidExperiences: workExperiences.filter((exp) => !exp.isPaid).length,
    };

    return {
      ...state,
      workExperiences,
      experienceSummary,
      currentStep: "experience_calculated",
    };
  }

  async verifyEmployment(state) {
    console.log("🔍 Verifying employment information...");
    const { workExperiences, experienceSummary } = state;

    const prompt = `Verify work experience data. Return ONLY valid JSON:

{
  "verified": true|false,
  "confidence": 0-100,
  "overallAssessment": "authentic|questionable|insufficient",
  "employmentConsistency": {
    "consistent": true|false,
    "gapsDetected": true|false,
    "overlapDetected": true|false,
    "issues": ["array of issues"]
  },
  "documentCompleteness": {
    "adequate": true|false,
    "missingDocuments": [],
    "recommendations": []
  },
  "redFlags": [],
  "positiveIndicators": [],
  "recommendation": "approve|review|reject"
}

Work Experiences:
${JSON.stringify(workExperiences, null, 2)}

Summary:
${JSON.stringify(experienceSummary, null, 2)}

Check for: logical dates, career progression, realistic salaries, legitimate companies, appropriate documentation.
Be LENIENT - small gaps and missing info are acceptable.`;

    try {
      let response;

      try {
        response = await this.verificationAgent.invoke(prompt);
      } catch (error) {
        console.warn("⚠️ Primary verification failed, using fallback...");
        response = await this.verificationFallback.invoke(prompt);
      }

      const verification = this.verificationAgent.parseJSON(response.content);

      return {
        ...state,
        verification,
        verificationComplete: true,
        currentStep: "employment_verified",
      };
    } catch (error) {
      console.error("❌ Employment verification failed:", error.message);

      // Fallback verification
      const fallbackVerification = {
        verified: workExperiences.length > 0,
        confidence: 60,
        overallAssessment: "insufficient",
        employmentConsistency: {
          consistent: true,
          gapsDetected: false,
          overlapDetected: false,
          issues: ["Verification service unavailable"],
        },
        documentCompleteness: {
          adequate: workExperiences.length > 0,
          missingDocuments: [],
          recommendations: ["Manual review recommended"],
        },
        redFlags: [],
        positiveIndicators:
          workExperiences.length > 0 ? ["Work documents provided"] : [],
        recommendation: "review",
      };

      return {
        ...state,
        verification: fallbackVerification,
        verificationComplete: true,
        errors: [
          ...state.errors,
          { step: "verification", error: error.message },
        ],
        currentStep: "verification_failed_fallback",
      };
    }
  }

  async generateReport(state) {
    console.log("📋 Generating work experience report...");
    const processingTime = Date.now() - state.startTime;

    return {
      ...state,
      currentStep: "complete",
      metadata: {
        processingTime,
        documentsProcessed: state.images.length,
        experiencesExtracted: state.workExperiences.length,
        extractionComplete: state.extractionComplete,
        validationComplete: state.validationComplete,
        verificationComplete: state.verificationComplete,
      },
    };
  }

  // Helper methods
  parseDate(dateString) {
    if (!dateString) return null;

    // Try DD/MM/YYYY format
    const parts = dateString.split("/");
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }

    return new Date(dateString);
  }

  getEarliestDate(dates) {
    const parsed = dates.map((d) => this.parseDate(d)).filter(Boolean);
    if (parsed.length === 0) return null;
    return new Date(Math.min(...parsed)).toLocaleDateString("en-GB");
  }

  getLatestDate(dates) {
    const parsed = dates.map((d) => this.parseDate(d)).filter(Boolean);
    if (parsed.length === 0) return null;
    return new Date(Math.max(...parsed)).toLocaleDateString("en-GB");
  }

  calculateMonthsDifference(start, end) {
    const months = (end.getFullYear() - start.getFullYear()) * 12;
    return months + end.getMonth() - start.getMonth();
  }

  // Public API
  async processWorkExperience(images, options = {}) {
    const initialState = {
      ...WORK_EXPERIENCE_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);

      return {
        success: result.extractionComplete,
        workExperiences: result.workExperiences || [],
        experienceSummary: result.experienceSummary || {},
        validation: result.overallValidation,
        verification: result.verification,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error("❌ Work experience workflow failed:", error);
      throw error;
    }
  }
}
