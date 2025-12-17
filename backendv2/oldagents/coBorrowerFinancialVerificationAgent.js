// agents/coBorrowerFinancialVerificationAgent.js
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const config = require("../config/config");

let groq = null;
let clientLock = false;

async function getGroqClient() {
  if (groq && !clientLock) return groq;
  if (clientLock) {
    while (clientLock) await new Promise((r) => setTimeout(r, 10));
    return groq;
  }

  clientLock = true;
  try {
    if (!config.ai.groqApiKey) throw new Error("GROQ_API_KEY missing");

    groq = new ChatGroq({
      apiKey: client.ai.groqApiKey2 || config.ai.groqApiKey,
      model: "openai/gpt-oss-20b",
      temperature: 0,
      maxTokens: 1024,
      timeout: 25000,
    });

    console.log(
      "✅ Groq client initialized for co-borrower financial verification"
    );
    return groq;
  } finally {
    clientLock = false;
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .trim()
    .replace(/```\s*/g, "")
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return null;
  }
}

/**
 * Verify co-borrower financial information
 * @param {Object} financialData - Extracted financial data
 * @param {Object} options - Options
 */
async function verifyCoBorrowerFinancialInfo(financialData, options = {}) {
  const startTime = Date.now();
  const { maxRetries = 2, timeout = 25000 } = options;

  try {
    if (!financialData || typeof financialData !== "object") {
      throw new Error("Invalid financial data");
    }

    const hasData = Object.values(financialData).some((val) => {
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "object" && val !== null) {
        return Object.values(val).some((v) => v !== null && v !== undefined);
      }
      return val !== null && val !== undefined;
    });

    if (!hasData) {
      return {
        valid: false,
        confidence: "low",
        reason: "No financial data extracted to verify",
        issues: ["No data found"],
        warnings: [],
      };
    }

    const prompt = `Verify co-borrower financial data for loan eligibility. Return ONLY valid JSON:
{
  "valid": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": "string",
  "issues": ["array of critical issues"],
  "warnings": ["array of warnings"],
  "financialMetrics": {
    "incomeStability": "stable/irregular/insufficient_data",
    "emiAffordability": "good/moderate/high_risk",
    "bankBehavior": "good/average/poor",
    "documentConsistency": "consistent/minor_gaps/major_gaps"
  }
}

Data to verify:
${JSON.stringify(financialData, null, 2)}

VERIFICATION CRITERIA:
1. **Income Verification**:
   - Average monthly income should be > ₹25,000
   - Salary slips should show consistent income
   - If < 3 salary slips, flag as insufficient data
   - ITR data should align with salary data (within 20% variance)

2. **FOIR (Fixed Obligation to Income Ratio)**:
   - Calculate: (Total EMIs / Gross Monthly Income) × 100
   - Good: FOIR < 40%
   - Moderate: FOIR 40-50%
   - High Risk: FOIR > 50%
   - Critical: FOIR > 60% (should be rejected)

3. **Bank Statement Analysis**:
   - Average balance should be > ₹5,000
   - No salary bounces in last 6 months
   - Regular salary credits
   - EMI payments should be on time (no delays)
   - Check for min balance violations

4. **Document Consistency**:
   - Name should match across all documents
   - PAN should match if present
   - Employer name should be consistent
   - Income figures should align (salary vs ITR vs Form 16)

5. **Red Flags (Mark as invalid)**:
   - FOIR > 60%
   - Salary bounces in bank statement
   - No income proof (0 salary slips and 0 ITR)
   - Average monthly income < ₹25,000 (based on policy)
   - Bank balance consistently < ₹5,000

6. **Yellow Flags (Warnings)**:
   - FOIR 50-60%
   - Only 1-2 salary slips
   - Irregular salary credits
   - Bank balance < ₹10,000
   - Income data mismatch > 20%

Return your analysis as JSON with:
- valid: true if no red flags, false otherwise
- confidence: high (all docs present, consistent), medium (some gaps), low (major issues)
- reason: Brief summary
- issues: Array of critical problems
- warnings: Array of concerns
- financialMetrics: Your assessment of each category`;

    const client = await getGroqClient();
    const message = new HumanMessage({ content: prompt });

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Verification timeout")), timeout)
          ),
        ]);

        let rawText = "";
        if (typeof response === "string") {
          rawText = response;
        } else if (response?.content) {
          rawText = Array.isArray(response.content)
            ? response.content.map((part) => part.text || part).join("\n")
            : response.content.text || response.content;
        }

        if (!rawText) throw new Error("Empty response from AI");

        const result = safeJsonParse(rawText);
        if (!result || typeof result.valid !== "boolean") {
          console.error(
            "❌ Invalid verification response:",
            rawText.slice(0, 300)
          );
          throw new Error("Invalid JSON from verification AI");
        }

        const verification = {
          valid: Boolean(result.valid),
          confidence: result.confidence || "medium",
          reason: String(result.reason || "No reason provided").slice(0, 500),
          issues: Array.isArray(result.issues) ? result.issues : [],
          warnings: Array.isArray(result.warnings) ? result.warnings : [],
          financialMetrics: result.financialMetrics || {},
        };

        const duration = Date.now() - startTime;
        console.log(
          `✅ Co-borrower financial verification: ${
            verification.valid ? "VALID" : "INVALID"
          } (${verification.confidence} confidence, ${duration}ms)`
        );
        console.log(`   - Issues: ${verification.issues.length}`);
        console.log(`   - Warnings: ${verification.warnings.length}`);

        if (verification.issues.length > 0) {
          console.log(
            `   - Critical issues: ${verification.issues.join(", ")}`
          );
        }

        return verification;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `⚠️ Verification attempt ${
              attempt + 1
            } failed, retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  } catch (error) {
    console.error(
      "❌ Co-borrower financial verification failed:",
      error.message
    );

    // Fallback verification with basic rules
    const fallbackVerification = performBasicVerification(financialData);
    return fallbackVerification;
  }
}

/**
 * Fallback basic verification if AI fails
 */
function performBasicVerification(financialData) {
  const issues = [];
  const warnings = [];

  // Check income
  const avgIncome = financialData.financialSummary?.avgMonthlyIncome || 0;
  if (avgIncome === 0) {
    issues.push("No income data found");
  } else if (avgIncome < 25000) {
    issues.push("Average monthly income below ₹25,000 minimum requirement");
  }

  // Check FOIR
  const foir = financialData.financialSummary?.foir || 0;
  if (foir > 60) {
    issues.push(`FOIR is ${foir}% (exceeds 60% limit)`);
  } else if (foir > 50) {
    warnings.push(`FOIR is ${foir}% (high risk - above 50%)`);
  }

  // Check salary slips
  const salarySlipCount = financialData.salarySlips?.length || 0;
  if (salarySlipCount === 0 && (financialData.itrData?.length || 0) === 0) {
    issues.push("No income proof documents found");
  } else if (salarySlipCount < 3 && salarySlipCount > 0) {
    warnings.push(
      `Only ${salarySlipCount} salary slip(s) provided (recommended: 3+)`
    );
  }

  const valid = issues.length === 0;

  return {
    valid,
    confidence: valid ? (warnings.length === 0 ? "high" : "medium") : "low",
    reason: valid
      ? "Basic validation passed (AI verification unavailable)"
      : "Failed basic validation checks",
    issues,
    warnings,
    financialMetrics: {
      incomeStability: avgIncome > 0 ? "insufficient_data" : "no_data",
      emiAffordability:
        foir > 50 ? "high_risk" : foir > 40 ? "moderate" : "good",
      bankBehavior: "insufficient_data",
      documentConsistency: "insufficient_data",
    },
  };
}

module.exports = { verifyCoBorrowerFinancialInfo };
