// ai/agents/documents/BankStatementAgent.js

import { StateGraph, END } from "@langchain/langgraph";
import { BaseAgent } from "../../core/BaseAgent.js";
import { AI_MODELS } from "../../config/aiModels.js";

const BANK_STATEMENT_STATE_SCHEMA = {
  images: [],
  accountDetails: null,
  monthlyAnalysis: [],
  overallAnalysis: null,
  extractionComplete: false,
  currentStep: "",
  errors: [],
  startTime: 0,
};

export class BankStatementAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK); // ✅ FIXED
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    console.log("🏦 Bank Statement Agent initialized");
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: BANK_STATEMENT_STATE_SCHEMA,
    });

    workflow.addNode("extract_account_details", (state) =>
      this.extractAccountDetails(state)
    );
    workflow.addNode("extract_transactions", (state) =>
      this.extractTransactions(state)
    );
    workflow.addNode("analyze_cash_flow", (state) =>
      this.analyzeCashFlow(state)
    );
    workflow.addNode("detect_salary_pattern", (state) =>
      this.detectSalaryPattern(state)
    );
    workflow.addNode("calculate_emi", (state) => this.calculateEMI(state));
    workflow.addNode("assess_financial_health", (state) =>
      this.assessFinancialHealth(state)
    );
    workflow.addNode("generate_report", (state) => this.generateReport(state));

    workflow.setEntryPoint("extract_account_details");

    workflow.addConditionalEdges(
      "extract_account_details",
      (state) => (state.accountDetails ? "transactions" : "end"),
      {
        transactions: "extract_transactions",
        end: "generate_report",
      }
    );

    workflow.addEdge("extract_transactions", "analyze_cash_flow");
    workflow.addEdge("analyze_cash_flow", "detect_salary_pattern");
    workflow.addEdge("detect_salary_pattern", "calculate_emi");
    workflow.addEdge("calculate_emi", "assess_financial_health");
    workflow.addEdge("assess_financial_health", "generate_report");
    workflow.addEdge("generate_report", END);

    return workflow;
  }

  async extractAccountDetails(state) {
    console.log("🏦 Extracting bank account details...");

    const prompt = `Extract bank statement account details. Return ONLY valid JSON:

{
  "accountNumber": "string (mask last 4: XXXX1234)",
  "accountHolderName": "string",
  "bankName": "string",
  "branch": "string or null",
  "ifscCode": "string or null",
  "accountType": "Savings|Current|null",
  "statementPeriod": {
    "from": "DD/MM/YYYY",
    "to": "DD/MM/YYYY"
  },
  "confidence": 85
}

NO markdown, NO explanations. ONLY JSON.`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(
          prompt,
          state.images.slice(0, 3)
        );
      } catch (error) {
        console.warn("⚠️ Primary extraction failed, using fallback...");
        response = await this.extractionFallback.invoke(
          prompt,
          state.images.slice(0, 3)
        );
      }

      const accountDetails = this.extractionAgent.parseJSON(response.content);

      return {
        ...state,
        accountDetails,
        currentStep: "account_details_extracted",
      };
    } catch (error) {
      console.error("❌ Account details extraction failed:", error.message);
      return {
        ...state,
        accountDetails: null,
        errors: [
          ...state.errors,
          { step: "account_details", error: error.message },
        ],
        currentStep: "account_details_failed",
      };
    }
  }

  async extractTransactions(state) {
    console.log("💳 Extracting transactions and monthly analysis...");

    const prompt = `CRITICAL: Return ONLY valid JSON. NO markdown, NO explanations, NO asterisks.

Extract bank statement transactions into this EXACT JSON structure:

{
  "monthlyAnalysis": [
    {
      "month": "January",
      "year": 2024,
      "summary": {
        "openingBalance": 50000,
        "closingBalance": 55000,
        "totalCredits": 75000,
        "totalDebits": 70000,
        "netFlow": 5000,
        "minBalance": 45000,
        "maxBalance": 60000,
        "averageBalance": 52500
      },
      "salaryCredits": [
        {
          "date": "05/01/2024",
          "amount": 60000,
          "description": "SALARY CREDIT",
          "isRegular": true
        }
      ],
      "emiDebits": [
        {
          "date": "10/01/2024",
          "amount": 15000,
          "description": "EMI DEBIT",
          "counterparty": "HDFC BANK"
        }
      ],
      "bouncedTransactions": 0,
      "returnCharges": 0,
      "transactionCount": 45
    }
  ],
  "confidence": 85
}

RULES:
1. ONLY return the JSON object above
2. Process ALL 6 months of data
3. Identify salary patterns (regular large credits)
4. Identify EMI patterns (regular fixed debits)
5. Calculate accurate monthly summaries
6. NO text before or after JSON
7. NO markdown formatting`;

    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(
          prompt,
          state.images.slice(0, 20)
        );
      } catch (error) {
        console.warn("⚠️ Primary extraction failed, using fallback...");
        response = await this.extractionFallback.invoke(
          prompt,
          state.images.slice(0, 20)
        );
      }

      // ✅ BETTER JSON EXTRACTION
      let jsonContent = response.content.trim();

      // Remove markdown code blocks if present
      jsonContent = jsonContent.replace(/``````\n?/g, "");

      // Remove leading asterisks or markdown
      jsonContent = jsonContent.replace(/^\*\*.*?\*\*\n*/gm, "");

      // Try to find JSON object
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }

      const extracted = JSON.parse(jsonContent);

      // ✅ VALIDATE STRUCTURE
      if (
        !extracted.monthlyAnalysis ||
        !Array.isArray(extracted.monthlyAnalysis)
      ) {
        throw new Error(
          "Invalid JSON structure: monthlyAnalysis missing or not an array"
        );
      }

      return {
        ...state,
        monthlyAnalysis: extracted.monthlyAnalysis,
        extractionComplete: true,
        currentStep: "transactions_extracted",
      };
    } catch (error) {
      console.error("❌ Transaction extraction failed:", error.message);

      // ✅ RETURN EMPTY BUT VALID STRUCTURE
      return {
        ...state,
        monthlyAnalysis: [], // Empty array instead of null
        extractionComplete: false,
        errors: [
          ...state.errors,
          { step: "transactions", error: error.message },
        ],
        currentStep: "transactions_failed",
      };
    }
  }

  async analyzeCashFlow(state) {
    console.log("📊 Analyzing cash flow patterns...");
    const { monthlyAnalysis } = state;

    // ✅ NULL/EMPTY CHECK
    if (!monthlyAnalysis || monthlyAnalysis.length === 0) {
      console.warn("⚠️ No monthly analysis data available");
      return {
        ...state,
        overallAnalysis: {
          ...state.overallAnalysis,
          cashFlow: {
            avgMonthlyCredits: 0,
            avgMonthlyDebits: 0,
            avgBalance: 0,
            savingsRate: 0,
          },
        },
        currentStep: "cash_flow_skipped",
      };
    }

    const avgMonthlyCredits =
      monthlyAnalysis.reduce(
        (sum, m) => sum + (m.summary?.totalCredits || 0),
        0
      ) / monthlyAnalysis.length;
    const avgMonthlyDebits =
      monthlyAnalysis.reduce(
        (sum, m) => sum + (m.summary?.totalDebits || 0),
        0
      ) / monthlyAnalysis.length;
    const avgBalance =
      monthlyAnalysis.reduce(
        (sum, m) => sum + (m.summary?.averageBalance || 0),
        0
      ) / monthlyAnalysis.length;

    const cashFlow = {
      avgMonthlyCredits: Math.round(avgMonthlyCredits),
      avgMonthlyDebits: Math.round(avgMonthlyDebits),
      avgBalance: Math.round(avgBalance),
      savingsRate:
        avgMonthlyCredits > 0
          ? (
              ((avgMonthlyCredits - avgMonthlyDebits) / avgMonthlyCredits) *
              100
            ).toFixed(2)
          : 0,
    };

    return {
      ...state,
      overallAnalysis: {
        ...state.overallAnalysis,
        cashFlow,
      },
      currentStep: "cash_flow_analyzed",
    };
  }

  async detectSalaryPattern(state) {
    console.log("💰 Detecting salary patterns...");
    const { monthlyAnalysis } = state;

    if (!monthlyAnalysis || monthlyAnalysis.length === 0) {
      return {
        ...state,
        overallAnalysis: {
          ...state.overallAnalysis,
          salaryConsistency: {
            present: false,
            regularity: "none",
            averageAmount: 0,
            variance: 0,
          },
        },
        currentStep: "salary_pattern_not_found",
      };
    }

    const allSalaryCredits = monthlyAnalysis.flatMap(
      (m) => m.salaryCredits || []
    );

    if (allSalaryCredits.length === 0) {
      return {
        ...state,
        overallAnalysis: {
          ...state.overallAnalysis,
          salaryConsistency: {
            present: false,
            regularity: "none",
            averageAmount: 0,
            variance: 0,
          },
        },
        currentStep: "salary_pattern_not_found",
      };
    }

    const salaryAmounts = allSalaryCredits.map((s) => s.amount).filter(Boolean);
    const avgSalary =
      salaryAmounts.reduce((a, b) => a + b, 0) / salaryAmounts.length;
    const variance =
      salaryAmounts.reduce(
        (sum, amt) => sum + Math.pow(amt - avgSalary, 2),
        0
      ) / salaryAmounts.length;
    const stdDev = Math.sqrt(variance);

    const salaryConsistency = {
      present: true,
      regularity:
        stdDev / avgSalary < 0.1
          ? "high"
          : stdDev / avgSalary < 0.2
          ? "medium"
          : "low",
      averageAmount: Math.round(avgSalary),
      variance: Math.round(stdDev),
      monthsWithSalary: monthlyAnalysis.filter(
        (m) => m.salaryCredits && m.salaryCredits.length > 0
      ).length,
    };

    return {
      ...state,
      overallAnalysis: {
        ...state.overallAnalysis,
        salaryConsistency,
      },
      currentStep: "salary_pattern_detected",
    };
  }

  async calculateEMI(state) {
    console.log("💳 Calculating EMI obligations...");
    const { monthlyAnalysis } = state;

    if (!monthlyAnalysis || monthlyAnalysis.length === 0) {
      return {
        ...state,
        overallAnalysis: {
          ...state.overallAnalysis,
          emiObligations: {
            totalMonthlyEMI: 0,
            numberOfLoans: 0,
            largestEMI: 0,
          },
        },
        currentStep: "emi_calculated",
      };
    }

    const allEMIs = monthlyAnalysis.flatMap((m) => m.emiDebits || []);

    if (allEMIs.length === 0) {
      return {
        ...state,
        overallAnalysis: {
          ...state.overallAnalysis,
          emiObligations: {
            totalMonthlyEMI: 0,
            numberOfLoans: 0,
            largestEMI: 0,
          },
        },
        currentStep: "emi_calculated",
      };
    }

    const loanMap = {};
    allEMIs.forEach((emi) => {
      const key = emi.counterparty || "Unknown";
      if (!loanMap[key]) {
        loanMap[key] = [];
      }
      loanMap[key].push(emi.amount);
    });

    const avgEMIPerLoan = Object.entries(loanMap).map(
      ([counterparty, amounts]) => {
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        return { counterparty, avgEMI: Math.round(avg) };
      }
    );

    const totalMonthlyEMI = avgEMIPerLoan.reduce(
      (sum, loan) => sum + loan.avgEMI,
      0
    );
    const largestEMI = Math.max(...avgEMIPerLoan.map((l) => l.avgEMI));

    return {
      ...state,
      overallAnalysis: {
        ...state.overallAnalysis,
        emiObligations: {
          totalMonthlyEMI,
          numberOfLoans: avgEMIPerLoan.length,
          largestEMI,
          loanBreakdown: avgEMIPerLoan,
        },
      },
      currentStep: "emi_calculated",
    };
  }

  async assessFinancialHealth(state) {
    console.log("🏥 Assessing financial health...");
    const { overallAnalysis } = state;

    const prompt = `Assess financial health from bank statement analysis. Return ONLY valid JSON:

{
  "loanEligibility": {
    "eligibleAmount": 500000,
    "riskLevel": "low",
    "recommendedTenure": "5 years"
  },
  "financialHealth": {
    "savingsRate": "good",
    "debtBurden": "low",
    "cashFlowStability": "stable"
  },
  "redFlags": [],
  "strengths": ["Consistent salary", "Good savings rate"]
}

Analysis Data:
${JSON.stringify(overallAnalysis, null, 2)}`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const assessment = this.verificationAgent.parseJSON(response.content);

      return {
        ...state,
        overallAnalysis: {
          ...overallAnalysis,
          assessment,
        },
        currentStep: "health_assessed",
      };
    } catch (error) {
      console.error("❌ Health assessment failed:", error.message);
      return {
        ...state,
        errors: [
          ...state.errors,
          { step: "health_assessment", error: error.message },
        ],
        currentStep: "health_assessment_failed",
      };
    }
  }

  async generateReport(state) {
    console.log("📋 Generating bank statement report...");
    const processingTime = Date.now() - state.startTime;

    return {
      ...state,
      currentStep: "complete",
      metadata: {
        processingTime,
        monthsAnalyzed: state.monthlyAnalysis.length,
        extractionComplete: state.extractionComplete,
      },
    };
  }

  async processBankStatement(images, options = {}) {
    const initialState = {
      ...BANK_STATEMENT_STATE_SCHEMA,
      images,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);

      return {
        success: result.extractionComplete && result.accountDetails !== null,
        accountDetails: result.accountDetails,
        monthlyAnalysis: result.monthlyAnalysis,
        overallAnalysis: result.overallAnalysis,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error("❌ Bank statement workflow failed:", error);
      throw error;
    }
  }
}
