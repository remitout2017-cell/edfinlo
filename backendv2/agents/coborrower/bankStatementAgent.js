// agents/coborrower/bankStatementAgent.js

const BaseAgent = require("./BaseAgent");

class BankStatementAgent {
  constructor() {
    this.agent = new BaseAgent("amazon/nova-2-lite-v1:free");
  }

  /**
   * Repair malformed JSON from AI responses
   */
  repairJSON(jsonString) {
    try {
      // First, try to parse as-is
      return JSON.parse(jsonString);
    } catch (e) {
      console.log('🔧 Attempting to repair malformed JSON...');
      
      let repaired = jsonString;
      
      // Remove trailing commas before closing brackets/braces
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix missing commas between array elements (closing brace followed by opening brace)
      repaired = repaired.replace(/\}(\s*)\{/g, '},$1{');
      
      // Fix missing commas between object properties (closing brace followed by quote)
      repaired = repaired.replace(/\}(\s*)"([^"]+)"(\s*):/g, '},$1"$2"$3:');
      
      // Fix missing commas after numbers/strings before opening braces
      repaired = repaired.replace(/(\d+|"[^"]*")(\s*)(\{|\[)/g, '$1,$2$3');
      
      // Fix multiple consecutive commas
      repaired = repaired.replace(/,+/g, ',');
      
      // Remove commas before closing brackets (again, after fixes)
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
      
      try {
        const parsed = JSON.parse(repaired);
        console.log('✅ JSON repair successful!');
        return parsed;
      } catch (secondError) {
        console.error('❌ JSON repair failed:', secondError.message);
        
        // Last resort: Try to truncate at last valid closing brace
        const objectMatch = repaired.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try {
            const jsonStr = objectMatch[0];
            let braceCount = 0;
            let lastValidIndex = -1;
            
            for (let i = 0; i < jsonStr.length; i++) {
              if (jsonStr[i] === '{') braceCount++;
              if (jsonStr[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  lastValidIndex = i;
                  break;
                }
              }
            }
            
            if (lastValidIndex > 0) {
              const truncated = jsonStr.substring(0, lastValidIndex + 1);
              const parsed = JSON.parse(truncated);
              console.log('✅ JSON extracted successfully (truncated at valid end)');
              return parsed;
            }
          } catch (truncError) {
            console.error('❌ Truncation failed:', truncError.message);
          }
        }
        
        throw new Error(`Unable to repair JSON: ${secondError.message}`);
      }
    }
  }

  /**
   * Safe parse response with JSON repair
   */
  safeParseResponse(response) {
    try {
      let raw = typeof response?.content === "string" 
        ? response.content 
        : response?.text || "";
      
      console.log(`📝 Raw response length: ${raw.length} characters`);
      
      if (raw.length < 10) {
        throw new Error("Empty or very short response from AI");
      }

      const text = (raw || "").trim();
      console.log(`📄 Response preview: ${text.substring(0, 200)}...`);

      // Remove markdown code blocks
      const cleanedText = text
        .replace(/^```\s*/gi, "")
        .replace(/^`\s*/g, "")
        .replace(/\s*`$/g, "")
        .trim();

      // Extract JSON
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/) || cleanedText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        // Use repair function instead of direct parsing
        const parsed = this.repairJSON(jsonMatch);
        console.log("✅ Successfully parsed JSON response");
        return parsed;
      }

      throw new Error("No JSON found in response");
    } catch (error) {
      console.error("❌ Failed to parse AI response:", error.message);
      throw error;
    }
  }

  async extractBankStatement(images) {
    const prompt = `Analyze 6-month bank statement. Extract comprehensive details. Return ONLY valid JSON with NO markdown formatting:

{
  "accountDetails": {
    "accountNumber": "string (mask last 4 digits: XXXX1234)",
    "accountHolderName": "string",
    "bankName": "string",
    "branch": "string",
    "ifscCode": "string",
    "accountType": "Savings",
    "statementPeriod": {
      "from": "DD/MM/YYYY",
      "to": "DD/MM/YYYY"
    }
  },
  "monthlyAnalysis": [
    {
      "month": "January",
      "year": 2024,
      "summary": {
        "openingBalance": 50000,
        "closingBalance": 55000,
        "totalCredits": 80000,
        "totalDebits": 75000,
        "netFlow": 5000,
        "minBalance": 48000,
        "maxBalance": 60000,
        "averageBalance": 52500
      },
      "salaryCredits": [
        {
          "date": "DD/MM/YYYY",
          "amount": 50000,
          "description": "SALARY CREDIT",
          "isRegular": true
        }
      ],
      "emiDebits": [
        {
          "date": "DD/MM/YYYY",
          "amount": 15000,
          "description": "LOAN EMI",
          "counterparty": "HDFC Bank"
        }
      ],
      "bouncedTransactions": 0,
      "returnCharges": 0,
      "transactionCount": 45
    }
  ],
  "overallAnalysis": {
    "averageMonthlyBalance": 52000,
    "salaryConsistency": {
      "present": true,
      "regularity": "high",
      "averageAmount": 50000,
      "variance": 500
    },
    "emiObligations": {
      "totalMonthlyEMI": 15000,
      "numberOfLoans": 1,
      "largestEMI": 15000
    },
    "cashFlow": {
      "avgMonthlyCredits": 75000,
      "avgMonthlyDebits": 70000,
      "savingsRate": 0.07
    },
    "riskIndicators": {
      "bounceCount": 0,
      "lowBalanceDays": 2,
      "overdraftUsage": 0
    },
    "behaviorScore": 0.9
  },
  "confidence": 0.9,
  "coverage": "full",
  "verification": {
    "hasRequiredPeriod": true,
    "hasSalaryCredits": true,
    "isAuthentic": true
  }
}

CRITICAL RULES:
1. Return ONLY the JSON object - NO markdown code blocks, NO backticks, NO explanatory text
2. Process ALL transactions across 6 months
3. Identify salary patterns (regular credits)
4. Calculate EMI obligations (fixed recurring debits)
5. Flag bounced/returned transactions
6. Calculate average balances accurately
7. Use DD/MM/YYYY for all dates
8. Ensure ALL arrays and objects have proper commas between elements
9. If you cannot extract complete data, still return valid JSON with null/0 values`;

    try {
      // Limit images to avoid token limits
      const limitedImages = images.slice(0, 20);
      const content = [
        { type: "text", text: prompt },
        ...this.agent.createImageContent(limitedImages)
      ];

      const messages = [{ role: "user", content }];
      
      console.log("🤖 Calling OpenRouter for bank statement analysis...");
      const response = await this.agent.invokeWithRetry(messages);
      console.log("✅ Received response from OpenRouter");
      
      // Use safe parse with JSON repair instead of direct parsing
      const data = this.safeParseResponse(response);

      // Enhance with additional insights if data is valid
      if (data.overallAnalysis && data.confidence > 0.5) {
        data.enhancedAnalysis = await this.enhanceAnalysis(data);
      }

      return data;
    } catch (error) {
      console.error("❌ Bank statement extraction failed:", error.message);
      return this.getFallbackData();
    }
  }

  async enhanceAnalysis(bankData) {
    const prompt = `Enhance bank statement analysis with financial insights. Return ONLY valid JSON with NO markdown:

{
  "loanEligibility": {
    "eligibleAmount": 500000,
    "riskLevel": "low",
    "recommendedTenure": "24 months"
  },
  "incomeVerification": {
    "verifiedIncome": 50000,
    "verificationMethod": "bank_credits",
    "confidence": 0.9
  },
  "financialHealth": {
    "savingsRate": "good",
    "debtBurden": "low",
    "cashFlowStability": "stable"
  },
  "redFlags": [],
  "strengths": ["Regular salary credits", "Low EMI burden", "Good savings rate"]
}

BANK DATA: ${JSON.stringify(bankData)}

Return ONLY the JSON object with NO additional text or formatting.`;

    try {
      const messages = [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ];

      const response = await this.agent.invokeWithRetry(messages);
      
      // Use safe parse with JSON repair
      return this.safeParseResponse(response);
    } catch (error) {
      console.warn("⚠️ Enhancement failed:", error.message);
      return this.getFallbackEnhancedData();
    }
  }

  getFallbackData() {
    return {
      accountDetails: {
        accountNumber: null,
        accountHolderName: null,
        bankName: null,
        branch: null,
        ifscCode: null,
        accountType: "Savings",
        statementPeriod: { from: null, to: null }
      },
      monthlyAnalysis: [],
      overallAnalysis: {
        averageMonthlyBalance: 0,
        salaryConsistency: { present: false, regularity: "low", averageAmount: 0, variance: 0 },
        emiObligations: { totalMonthlyEMI: 0, numberOfLoans: 0, largestEMI: 0 },
        cashFlow: { avgMonthlyCredits: 0, avgMonthlyDebits: 0, savingsRate: 0 },
        riskIndicators: { bounceCount: 0, lowBalanceDays: 0, overdraftUsage: 0 },
        behaviorScore: 0.5
      },
      confidence: 0.1,
      coverage: "minimal",
      verification: { hasRequiredPeriod: false, hasSalaryCredits: false, isAuthentic: false }
    };
  }

  getFallbackEnhancedData() {
    return {
      loanEligibility: { eligibleAmount: 0, riskLevel: "medium", recommendedTenure: "12 months" },
      incomeVerification: { verifiedIncome: 0, verificationMethod: "bank_credits", confidence: 0.5 },
      financialHealth: { savingsRate: "average", debtBurden: "medium", cashFlowStability: "stable" },
      redFlags: [],
      strengths: []
    };
  }
}

module.exports = new BankStatementAgent();
