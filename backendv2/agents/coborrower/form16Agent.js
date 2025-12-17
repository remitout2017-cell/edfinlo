// agents/coborrower/form16Agent.js
const BaseAgent = require("./BaseAgent");

class Form16Agent {
  constructor() {
    this.agent = new BaseAgent("amazon/nova-2-lite-v1:free");
  }

  async extractForm16Details(imagesByYear) {
    const results = [];

    for (const [year, images] of Object.entries(imagesByYear)) {
      const prompt = `Extract Form 16 details for FY ${year}. Return ONLY JSON:

{
  "financialYear": "string (e.g., 2023-24)",
  "assessmentYear": "string (e.g., 2024-25)",
  "employerName": "string",
  "employerTAN": "string",
  "employerAddress": "string",
  "employeeName": "string",
  "employeePAN": "string",
  "grossSalary": number,
  "allowances": number,
  "perquisites": number,
  "profitsInLieuOfSalary": number,
  "totalSalary": number,
  "standardDeduction": number,
  "entertainmentAllowance": number,
  "professionalTax": number,
  "incomeUnderHeadSalary": number,
  "deductions80C": number,
  "deductions80CCC": number,
  "deductions80CCD": number,
  "deductions80D": number,
  "deductions80E": number,
  "deductions80G": number,
  "totalChapterVIADeductions": number,
  "totalIncome": number,
  "taxOnTotalIncome": number,
  "surcharge": number,
  "healthAndEducationCess": number,
  "totalTaxLiability": number,
  "reliefUnderSection89": number,
  "taxDeducted": number,
  "confidence": 0.9,
  "isComplete": true/false,
  "matchesITR": true/false
}

EXTRACTION RULES:
1. Extract from all parts (Part A and Part B)
2. Verify calculations match
3. Validate PAN and TAN formats
4. Cross-check with salary slips if available`;

      try {
        const content = [
          { type: "text", text: prompt },
          ...this.agent.createImageContent(images.slice(0, 5))
        ];

        const messages = [{ role: "user", content }];

        const response = await this.agent.invokeWithRetry(messages);
        const data = this.agent.parseResponse(response);
        data.year = year;

        results.push(data);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to extract Form 16 ${year}:`, error.message);
        results.push(this.getFallbackData(year));
      }
    }

    return results;
  }

  async compareWithITR(form16Data, itrData) {
    if (!itrData || !form16Data) return form16Data;

    const prompt = `Compare Form 16 with ITR for consistency. Return ONLY JSON:

{
  "incomeMatch": true/false,
  "taxMatch": true/false,
  "discrepancies": ["list of discrepancies"],
  "matchScore": 0.95,
  "verificationStatus": "verified/partial/mismatch"
}

DATA:
Form 16: ${JSON.stringify(form16Data)}
ITR: ${JSON.stringify(itrData)}`;

    try {
      const messages = [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ];

      const response = await this.agent.invokeWithRetry(messages);
      const comparison = this.agent.parseResponse(response);

      form16Data.comparisonWithITR = comparison;
      form16Data.verificationStatus = comparison.verificationStatus;
      return form16Data;
    } catch (error) {
      console.error("Failed to compare with ITR:", error);
      return form16Data;
    }
  }

  getFallbackData(year) {
    const y = parseInt(year, 10) || new Date().getFullYear();
    return {
      financialYear: `${y}-${y + 1}`,
      assessmentYear: `${y + 1}-${y + 2}`,
      employerName: null,
      employeePAN: null,
      grossSalary: 0,
      totalSalary: 0,
      totalIncome: 0,
      taxDeducted: 0,
      confidence: 0.1,
      isComplete: false,
    };
  }
}

module.exports = new Form16Agent();