// Specialized Academic Records Workflow
import { StateGraph, END } from "@langchain/langgraph";
import { AcademicRecordsAgent } from "../agents/documents/AcademicRecordsAgent.js";
import { AdmissionLetterAgent } from "../agents/documents/AdmissionLetterAgent.js";
import { AcademicVerificationAgent } from "../agents/verification/AcademicVerificationAgent.js";

const ACADEMIC_WORKFLOW_STATE = {
  documents: {
    class10: [],
    class12: [],
    undergraduate: [],
    postgraduate: [],
    admissionLetter: [],
  },
  results: {
    class10: null,
    class12: null,
    undergraduate: null,
    postgraduate: null,
    admission: null,
  },
  verification: null,
  eligibilityCheck: null,
  currentStep: "",
  errors: [],
  startTime: 0,
};

export class AcademicWorkflow {
  constructor() {
    this.academicAgent = new AcademicRecordsAgent();
    this.admissionAgent = new AdmissionLetterAgent();
    this.verificationAgent = new AcademicVerificationAgent();

    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();

    console.log("🎓 Academic Workflow initialized");
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: ACADEMIC_WORKFLOW_STATE,
    });

    workflow.addNode("process_academic_docs", (state) =>
      this.processAcademicDocs(state)
    );
    workflow.addNode("process_admission", (state) =>
      this.processAdmission(state)
    );
    workflow.addNode("verify_progression", (state) =>
      this.verifyProgression(state)
    );
    workflow.addNode("check_eligibility", (state) =>
      this.checkEligibility(state)
    );
    workflow.addNode("generate_academic_report", (state) =>
      this.generateReport(state)
    );

    workflow.setEntryPoint("process_academic_docs");

    workflow.addEdge("process_academic_docs", "process_admission");
    workflow.addEdge("process_admission", "verify_progression");
    workflow.addEdge("verify_progression", "check_eligibility");
    workflow.addEdge("check_eligibility", "generate_academic_report");
    workflow.addEdge("generate_academic_report", END);

    return workflow;
  }

  async processAcademicDocs(state) {
    console.log("📚 Processing all academic records...");

    const results = {};
    const errors = [];

    // Process each level if provided
    const academicLevels = [
      "class10",
      "class12",
      "undergraduate",
      "postgraduate",
    ];

    for (const level of academicLevels) {
      if (state.documents[level] && state.documents[level].length > 0) {
        try {
          const result = await this.academicAgent.processAcademicRecords(
            state.documents[level],
            level
          );
          results[level] = result;
        } catch (error) {
          errors.push({ level, error: error.message });
        }
      }
    }

    return {
      ...state,
      results: { ...state.results, ...results },
      errors: [...state.errors, ...errors],
      currentStep: "academic_docs_processed",
    };
  }

  async processAdmission(state) {
    console.log("🎓 Processing admission letter...");

    if (
      !state.documents.admissionLetter ||
      state.documents.admissionLetter.length === 0
    ) {
      return {
        ...state,
        currentStep: "admission_skipped",
      };
    }

    try {
      const result = await this.admissionAgent.processAdmissionLetter(
        state.documents.admissionLetter
      );

      return {
        ...state,
        results: {
          ...state.results,
          admission: result,
        },
        currentStep: "admission_processed",
      };
    } catch (error) {
      return {
        ...state,
        errors: [...state.errors, { step: "admission", error: error.message }],
        currentStep: "admission_failed",
      };
    }
  }

  async verifyProgression(state) {
    console.log("🔍 Verifying academic progression...");

    try {
      const verification =
        await this.verificationAgent.verifyAcademicProgression(
          state.results.class10?.academicData,
          state.results.class12?.academicData,
          state.results.undergraduate?.academicData,
          state.results.postgraduate?.academicData
        );

      return {
        ...state,
        verification,
        currentStep: "progression_verified",
      };
    } catch (error) {
      return {
        ...state,
        errors: [
          ...state.errors,
          { step: "verification", error: error.message },
        ],
        currentStep: "verification_failed",
      };
    }
  }

  async checkEligibility(state) {
    console.log("✅ Checking eligibility for admission...");

    if (!state.results.admission) {
      return {
        ...state,
        currentStep: "eligibility_skipped",
      };
    }

    try {
      const eligibilityCheck =
        await this.verificationAgent.verifyAgainstAdmission(
          state.results,
          state.results.admission.admissionData
        );

      return {
        ...state,
        eligibilityCheck,
        currentStep: "eligibility_checked",
      };
    } catch (error) {
      return {
        ...state,
        errors: [
          ...state.errors,
          { step: "eligibility", error: error.message },
        ],
        currentStep: "eligibility_failed",
      };
    }
  }

  async generateReport(state) {
    console.log("📊 Generating academic report...");

    const processingTime = Date.now() - state.startTime;

    return {
      ...state,
      currentStep: "complete",
      metadata: {
        processingTime,
        documentsProcessed: {
          class10: !!state.results.class10,
          class12: !!state.results.class12,
          undergraduate: !!state.results.undergraduate,
          postgraduate: !!state.results.postgraduate,
          admission: !!state.results.admission,
        },
      },
    };
  }

  async processAcademics(documents) {
    const initialState = {
      ...ACADEMIC_WORKFLOW_STATE,
      documents,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);

      return {
        success: true,
        results: result.results,
        verification: result.verification,
        eligibilityCheck: result.eligibilityCheck,
        metadata: result.metadata,
        errors: result.errors,
      };
    } catch (error) {
      console.error("❌ Academic workflow failed:", error);
      throw error;
    }
  }
}
