// agents/academicVerificationAgent.js
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
      apiKey: config.ai.groqApiKey,
      model: "openai/gpt-oss-120b",
      temperature: 0,
      maxTokens: 512,
      timeout: 20000,
    });

    console.log("✅ Groq client initialized for academic verification");
    return groq;
  } finally {
    clientLock = false;
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

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
 * Verify academic information using GROQ
 * @param {Object} extractedData - Extracted academic data
 * @param {string} educationType - Type of education
 * @param {Object} options - Configuration options
 */
async function verifyAcademicInfo(
  extractedData,
  educationType = "general",
  options = {}
) {
  const startTime = Date.now();
  const { maxRetries = 2, timeout = 20000 } = options;

  try {
    if (!extractedData || typeof extractedData !== "object") {
      throw new Error("Invalid extracted data");
    }

    const hasData = Object.values(extractedData).some(
      (val) => val !== null && val !== undefined
    );

    if (!hasData) {
      return {
        valid: false,
        confidence: "low",
        reason: "No data extracted to verify",
      };
    }

    const prompt = `Verify this ${educationType} academic data. Return ONLY valid JSON:
{
  "valid": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": "string"
}

Data to verify:
${JSON.stringify(extractedData, null, 2)}

Validation rules:
1. Year must be between 1990-${new Date().getFullYear()}
2. Percentage must be 0-100
3. CGPA must be 0-10 (if present)
4. At least 2 fields should be extracted
5. Institution name is optional for Class 10/12
6. Data should be logically consistent

Return valid:true with confidence if data meets criteria.`;

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
        };

        const duration = Date.now() - startTime;
        console.log(
          `✅ Academic verification: ${
            verification.valid ? "VALID" : "INVALID"
          } (${verification.confidence} confidence, ${duration}ms)`
        );

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
    console.error("❌ Academic verification failed:", error.message);

    // Return safe fallback
    return {
      valid: false,
      confidence: "low",
      reason: `Verification error: ${error.message}`,
    };
  }
}

module.exports = { verifyAcademicInfo };
