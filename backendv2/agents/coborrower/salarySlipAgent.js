// agents/coborrower/salarySlipAgent.js
const BaseAgent = require("./BaseAgent");

class SalarySlipAgent {
  constructor() {
    this.agent = new BaseAgent("amazon/nova-2-lite-v1:free");
  }

  async extractSalaryDetails(imagesByMonth) {
    const results = [];

    for (const [monthIndex, monthImages] of Object.entries(imagesByMonth)) {
      const prompt = `Extract salary slip details for Month ${parseInt(monthIndex, 10) + 1}. Return ONLY JSON:

{
  "month": "string (e.g., January, Feb)",
  "year": number,
  "employerName": "string",
  "employeeName": "string",
  "employeeId": "string",
  "designation": "string",
  "paymentDate": "DD/MM/YYYY",
  "basicSalary": number,
  "hra": number,
  "conveyanceAllowance": number,
  "medicalAllowance": number,
  "specialAllowance": number,
  "otherAllowances": number,
  "grossSalary": number,
  "providentFund": number,
  "professionalTax": number,
  "incomeTax": number,
  "otherDeductions": number,
  "netSalary": number,
  "totalEarnings": number,
  "totalDeductions": number,
  "confidence": 0.9,
  "isConsistent": true/false,
  "extractionQuality": "high/medium/low"
}

EXTRACTION RULES:
1. Sum all earnings components for gross salary
2. Sum all deductions
3. Net = Gross - Deductions
4. Validate calculations
5. Extract exact dates and amounts in DD/MM/YYYY format`;

      try {
        const content = [
          { type: "text", text: prompt },
          ...this.agent.createImageContent(monthImages.slice(0, 5))
        ];

        const messages = [{ role: "user", content }];

        const response = await this.agent.invokeWithRetry(messages);
        const data = this.agent.parseResponse(response);
        data.monthIndex = parseInt(monthIndex, 10);

        results.push(data);

        // Delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to extract salary slip month ${monthIndex}:`, error.message);
        results.push(this.getFallbackData(parseInt(monthIndex, 10)));
      }
    }

    return this.analyzeConsistency(results);
  }

  analyzeConsistency(salarySlips) {
    if (salarySlips.length < 2) return salarySlips;

    const netSalaries = salarySlips.map((s) => s.netSalary).filter(Boolean);
    if (netSalaries.length === 0) return salarySlips;

    const avgSalary = netSalaries.reduce((a, b) => a + b, 0) / netSalaries.length;

    salarySlips.forEach((slip) => {
      if (slip.netSalary) {
        const variance = Math.abs((slip.netSalary - avgSalary) / avgSalary);
        slip.isConsistent = variance < 0.15;
        slip.salaryStability = variance < 0.1 ? "high" : variance < 0.2 ? "medium" : "low";
      }
    });

    return salarySlips;
  }

  getFallbackData(monthIndex) {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return {
      month: months[monthIndex] || "Unknown",
      year: new Date().getFullYear(),
      employerName: null,
      employeeName: null,
      basicSalary: 0,
      hra: 0,
      grossSalary: 0,
      netSalary: 0,
      confidence: 0.1,
      isConsistent: false,
      extractionQuality: "low",
    };
  }
}

module.exports = new SalarySlipAgent();