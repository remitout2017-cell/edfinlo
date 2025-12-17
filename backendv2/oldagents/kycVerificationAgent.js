// agents/kycVerificationAgent.js - PURE AI KYC (No rules, no hardcoding)
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const config = require("../config/config");

let groqClient = null;
let clientLock = false;

const METRICS = { totalCalls: 0, successes: 0, failures: 0, avgLatency: 0 };

async function getGroqClient() {
  if (groqClient && !clientLock) return groqClient;
  if (clientLock)
    while (clientLock) await new Promise((r) => setTimeout(r, 10));

  clientLock = true;
  try {
    if (!config.ai.groqApiKey) throw new Error("GROQ_API_KEY missing");

    groqClient = new ChatGroq({
      apiKey: config.ai.groqApiKey,
      model: "openai/gpt-oss-120b",
      temperature: 0.1, // Slightly creative for real-world variations
      maxTokens: 512, // Verification needs minimal output
      timeout: 30000, // 15s timeout for fast failure
    });
    console.log("🤖 Pure AI KYC Verifier initialized");
    return groqClient;
  } finally {
    clientLock = false;
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .replace(/\|[^|]*\|/g, "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/\*\*[^*]*\*\*/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .trim();

  const JSON_REGEX = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/;
  const match = cleaned.match(JSON_REGEX);
  try {
    return JSON.parse(match[0]);
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

async function verifyKycInfo(extractedData, options = {}) {
  const startTime = Date.now();
  const { maxRetries = 2, timeout = 30000 } = options;

  try {
    // Input validation
    if (!extractedData || typeof extractedData !== "object") {
      throw new Error("Invalid extracted data provided");
    }

    const hasData = Object.values(extractedData).some(
      (val) => val !== null && val !== undefined
    );
    if (!hasData) {
      return {
        valid: false,
        confidence: 0,
        reason: "No data extracted to verify",
      };
    }

    const prompt = `Verify Indian KYC data consistency. Return ONLY valid JSON:
{
  "valid": boolean,
  "confidence": number (0-100),
  "reason": "string"
}

Data to verify:
${JSON.stringify(extractedData, null, 2)}

Validation rules:
1. Name consistency across documents (allow minor variations)
2. DOB consistency (same date across documents)
3. Aadhaar: 12 digits
4. PAN: format ABCDE1234F
5. Dates must be valid and logical
6. At least 2 documents with matching names

Return valid:true if data is consistent and meets criteria, false otherwise.`;
    // 🔥 PRODUCTION AI KYC SYSTEM PROMPT

    const client = await getGroqClient();
    const message = new HumanMessage({ content: prompt });
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Groq timeout")), timeout)
          ),
        ]);
        let rawText = "";
        if (typeof response === "string") {
          rawText = response;
        } else if (response?.content) {
          rawText = Array.isArray(response.content)
            ? response.content.map((part) => part.text || part).join("\n")
            : response.content.text || response.content;
        } else if (response?.text) {
          rawText = response.text;
        }

        if (!rawText) throw new Error("Empty response from Groq");
        // Parse JSON response
        const result = safeJsonParse(rawText);
        if (!result || typeof result.valid !== "boolean") {
          console.error("❌ Groq response:", rawText.slice(0, 300));
          throw new Error("Invalid JSON structure from Groq");
        }

        // Normalize output
        const verification = {
          valid: Boolean(result.valid),
          confidence: Math.min(
            Math.max(Number(result.confidence) || 0, 0),
            100
          ),
          reason: String(result.reason || "No reason provided").slice(0, 500),
        };
        const duration = Date.now() - startTime;
        console.log(
          `✅ KYC verification: ${verification.valid ? "VALID" : "INVALID"} (${
            verification.confidence
          }% confidence, ${duration}ms)`
        );

        return verification;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(
            `⚠️ Groq verification attempt ${attempt + 1} failed: ${
              error.message
            }. Retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  } catch (error) {
    console.error(`❌ KYC verification failed:`, error.message);
    return {
      valid: false,
      confidence: 0,
      reason: `Verification service error: ${error.message}`,
    };
  }
}

module.exports = { verifyKycInfo };
