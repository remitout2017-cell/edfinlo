// ai/workflows/LoanAnalysisWorkflow.js

const { StateGraph, END } = require("@langchain/langgraph");
const { BaseAgent } = require("../core/BaseAgent");
const { AI_MODELS } = require("../config/aiModels");

class LoanAnalysisWorkflow {
  constructor() {
    this.analysisAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: {
        input: null,
        eligibility: null,
        risk: null,
        financial: null,
        recommendations: null,
        meta: null,
        complete: false,
      },
    });

    workflow.addNode("analyze_financial", (state) => this.analyzeFinancial(state));
    workflow.addNode("assess_eligibility", (state) => this.assessEligibility(state));
    workflow.addNode("assess_risk", (state) => this.assessRisk(state));
    workflow.addNode("generate_recommendations", (state) => this.generateRecommendations(state));

    workflow.setEntryPoint("analyze_financial");
    workflow.addEdge("analyze_financial", "assess_eligibility");
    workflow.addEdge("assess_eligibility", "assess_risk");
    workflow.addEdge("assess_risk", "generate_recommendations");
    workflow.addEdge("generate_recommendations", END);

    return workflow;
  }

  // ---------- deterministic finance ----------
  analyzeFinancial(state) {
    const coBorrowers = state.input.coBorrowers || [];
    const requestedAmount = state.input.loanRequest.requestedAmount;
    const tenure = state.input.loanRequest.requestedTenure || 60;

    const totalMonthlyIncome = coBorrowers.reduce(
      (sum, cb) => sum + (cb.financial?.avgMonthlySalary || 0),
      0
    );
    const existingObligations = coBorrowers.reduce(
      (sum, cb) => sum + (cb.financial?.totalExistingEmi || 0),
      0
    );

    // Keep a consistent baseline; later make it NBFC-specific during matching
    const annualRate = 0.1;
    const r = annualRate / 12;

    const estimatedEmi = Math.round(
      (requestedAmount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1)
    );

    const totalEmi = existingObligations + estimatedEmi;
    const foir = totalMonthlyIncome > 0 ? (totalEmi / totalMonthlyIncome) * 100 : 100;
    const availableIncome = totalMonthlyIncome - totalEmi;

    const affordability =
      foir < 30 ? "excellent" : foir < 40 ? "good" : foir < 50 ? "moderate" : "poor";

    return {
      ...state,
      financial: {
        totalMonthlyIncome,
        existingObligations,
        estimatedEmi,
        totalEmi,
        foir: Number(foir.toFixed(2)),
        availableIncome,
        debtToIncomeRatio: Number(foir.toFixed(2)),
        affordability,
      },
      meta: { aiModel: AI_MODELS.VERIFICATION_PRIMARY },
    };
  }

  // ---------- AI eligibility with hard validation ----------
  async assessEligibility(state) {
    const payload = {
      student: state.input.student,
      coBorrowers: state.input.coBorrowers,
      loanRequest: state.input.loanRequest,
      financial: state.financial,
    };

    const prompt = `
Return ONLY valid JSON with keys:
eligible (boolean),
maxEligibleAmount (number),
recommendedAmount (number),
recommendedTenure (number),
approvalProbability (0-100),
reasoning (string),
factors { academic, financial, documentation }.

Context:
${JSON.stringify(payload, null, 2)}
`;

    try {
      const response = await this.analysisAgent.invoke(prompt);
      const parsed = this.analysisAgent.parseJSON(response.content);

      // Minimal guardrails
      const eligibility = {
        eligible: !!parsed.eligible,
        maxEligibleAmount: Number(parsed.maxEligibleAmount || 0),
        recommendedAmount: Number(parsed.recommendedAmount || 0),
        recommendedTenure: Number(parsed.recommendedTenure || state.input.loanRequest.requestedTenure || 60),
        approvalProbability: Math.min(100, Math.max(0, Number(parsed.approvalProbability || 0))),
        reasoning: String(parsed.reasoning || ""),
        factors: parsed.factors || { academic: "missing", financial: "missing", documentation: "partial" },
      };

      return { ...state, eligibility };
    } catch (e) {
      // Deterministic fallback eligibility
      const kycOk = state.input.student?.kyc?.verified;
      const admissionOk = !!state.input.student?.admission;
      const academicOk = !!state.input.student?.academic;
      const incomeOk = (state.financial?.totalMonthlyIncome || 0) > 0;
      const foirOk = (state.financial?.foir || 100) < 60;

      const eligible = !!(kycOk && admissionOk && academicOk && incomeOk && foirOk);

      return {
        ...state,
        eligibility: {
          eligible,
          maxEligibleAmount: eligible ? state.input.loanRequest.requestedAmount : 0,
          recommendedAmount: eligible ? Math.round(state.input.loanRequest.requestedAmount * 0.9) : 0,
          recommendedTenure: state.input.loanRequest.requestedTenure || 60,
          approvalProbability: eligible ? 60 : 20,
          reasoning: eligible
            ? "Eligible by baseline checks (KYC, docs, income, FOIR)."
            : "Not eligible by baseline checks (missing docs/weak FOIR/income).",
          factors: {
            academic: academicOk ? "good" : "missing",
            financial: foirOk ? "moderate" : "weak",
            documentation: kycOk && admissionOk && academicOk ? "complete" : "partial",
          },
        },
      };
    }
  }

  // ---------- AI risk with hard validation ----------
  async assessRisk(state) {
    const payload = {
      student: state.input.student,
      coBorrowers: state.input.coBorrowers,
      eligibility: state.eligibility,
      financial: state.financial,
    };

    const prompt = `
Return ONLY valid JSON with keys:
overallRisk ("low"|"medium"|"high"),
riskScore (0-100, lower better),
riskLevel ("very_low"|"low"|"moderate"|"high"|"very_high"),
riskFactors (string[]),
strengths (string[]),
mitigationSuggestions (string[]).

Context:
${JSON.stringify(payload, null, 2)}
`;

    try {
      const response = await this.analysisAgent.invoke(prompt);
      const parsed = this.analysisAgent.parseJSON(response.content);

      const riskAssessment = {
        overallRisk: ["low", "medium", "high"].includes(parsed.overallRisk) ? parsed.overallRisk : "high",
        riskScore: Math.min(100, Math.max(0, Number(parsed.riskScore || 75))),
        riskLevel: parsed.riskLevel || "high",
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        mitigationSuggestions: Array.isArray(parsed.mitigationSuggestions) ? parsed.mitigationSuggestions : [],
      };

      return { ...state, risk: riskAssessment };
    } catch (e) {
      const foir = state.financial?.foir || 100;
      const overallRisk = foir < 40 ? "low" : foir < 60 ? "medium" : "high";

      return {
        ...state,
        risk: {
          overallRisk,
          riskScore: overallRisk === "low" ? 25 : overallRisk === "medium" ? 55 : 80,
          riskLevel: overallRisk === "low" ? "low" : overallRisk === "medium" ? "moderate" : "high",
          riskFactors: overallRisk === "high" ? ["High FOIR / limited buffer after EMI"] : [],
          strengths: overallRisk === "low" ? ["Good affordability"] : [],
          mitigationSuggestions: ["Improve FOIR and document completeness before applying."],
        },
      };
    }
  }

  // ---------- recommendations ----------
  async generateRecommendations(state) {
    const payload = {
      eligibility: state.eligibility,
      riskAssessment: state.risk,
      financialSummary: state.financial,
    };

    const prompt = `
Return ONLY valid JSON with keys:
alternatives (array),
improvements (string[]),
timeline { immediate, shortTerm, longTerm }.

Context:
${JSON.stringify(payload, null, 2)}
`;

    try {
      const response = await this.analysisAgent.invoke(prompt);
      const parsed = this.analysisAgent.parseJSON(response.content);

      return {
        ...state,
        recommendations: {
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          timeline: parsed.timeline || { immediate: [], shortTerm: [], longTerm: [] },
        },
        complete: true,
      };
    } catch (e) {
      return {
        ...state,
        recommendations: {
          alternatives: [],
          improvements: ["Upload complete co-borrower income proof and reduce FOIR below 50%."],
          timeline: { immediate: ["Upload missing documents"], shortTerm: [], longTerm: [] },
        },
        complete: true,
      };
    }
  }

  async analyze(input) {
    const initialState = {
      input,
      eligibility: null,
      risk: null,
      financial: null,
      recommendations: null,
      meta: null,
      complete: false,
    };

    return this.app.invoke(initialState);
  }
}

module.exports = { LoanAnalysisWorkflow };
