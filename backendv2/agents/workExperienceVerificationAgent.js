// agents/workExperienceVerificationAgent.js

const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const config = require("../config/config");

// Use global fetch if available (Node 18+), otherwise node-fetch
const fetch = global.fetch || require("node-fetch");

let groqPrimary = null;
let groqSecondary = null;
let clientLock = false;

async function getGroqClient(primary = true) {
  if (primary) {
    if (groqPrimary && !clientLock) return groqPrimary;
  } else {
    if (groqSecondary && !clientLock) return groqSecondary;
  }

  if (clientLock) {
    while (clientLock) {
      await new Promise((r) => setTimeout(r, 10));
    }
    return primary ? groqPrimary : groqSecondary;
  }

  clientLock = true;
  try {
    const key = primary
      ? config.ai.groqApiKey
      : config.ai.groqApiKey2 || process.env.GROQ_API_KEY2;

    if (!key) {
      throw new Error(
        primary ? "GROQ_API_KEY missing" : "GROQ_API_KEY2 missing"
      );
    }

    const client = new ChatGroq({
      apiKey: key,
      model: "groqcompound", // as requested
      temperature: 0.1,
      maxTokens: 512,
      timeout: 20000,
    });

    if (primary) {
      groqPrimary = client;
      console.log("✅ Groq PRIMARY client initialized for work verification");
    } else {
      groqSecondary = client;
      console.log("✅ Groq SECONDARY client initialized for work verification");
    }

    return client;
  } finally {
    clientLock = false;
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .replace(/\|[^|]*\|/g, "")
    .replace(/```/g, "")
    .replace(/\*\*[^*]*\*\*/g, "")
    .replace(/^\s*[-–—]\s*/gm, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // ignore
      }
    }
    return null;
  }
}

function extractTextFromGroqResponse(response) {
  if (typeof response === "string") {
    return response;
  }

  if (response?.content) {
    if (Array.isArray(response.content)) {
      return response.content.map((part) => part.text || part).join("\n");
    }
    return response.content.text || response.content;
  }

  return "";
}

// Call Groq (primary or secondary key) and return raw text
async function callGroqVerifier(primary, prompt, maxRetries, timeout) {
  const client = await getGroqClient(primary);
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

      const rawText = extractTextFromGroqResponse(response);
      if (!rawText) throw new Error("Empty response from Groq");

      return rawText;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `⚠️ Groq (${primary ? "primary" : "secondary"}) attempt ${
            attempt + 1
          } failed, retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Groq verification failed");
}

// OpenRouter text model call – returns plain string
async function callOpenRouterTextModel(model, prompt) {
  if (!config.ai.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  const res = await fetch(`${config.ai.openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.frontendUrl || "https://localhost",
      "X-Title": "work-experience-verification",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter ${model} error: ${res.status} ${res.statusText} ${body}`
    );
  }

  const json = await res.json();
  const choice = json.choices && json.choices[0];
  if (!choice) {
    throw new Error(`OpenRouter ${model} returned no choices`);
  }

  const content = choice.message && choice.message.content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof content === "string") return content;

  return "";
}

/**
 * Verify work experience information
 * @param {Object} workData - Extracted work data
 * @param {Object} options - Options
 */
async function verifyWorkExperienceInfo(workData, options = {}) {
  const startTime = Date.now();
  const { maxRetries = 2, timeout = 20000 } = options;

  try {
    if (!workData || typeof workData !== "object") {
      throw new Error("Invalid work data");
    }

    const hasData = Object.values(workData).some(
      (val) => val !== null && val !== undefined
    );

    if (!hasData) {
      return {
        valid: false,
        confidence: "low",
        reason: "No data extracted to verify",
      };
    }

    // Same lenient prompt as before (unchanged)
    const prompt = `You are validating work experience data extracted from employment documents. Return ONLY valid JSON.

DATA TO VERIFY:

${JSON.stringify(workData, null, 2)}

VALIDATION RULES (be realistic, not overly strict):

REQUIRED (must have):
1. Company name must be present and not empty
2. Job title must be present and not empty

REASONABLE CHECKS:
3. Start date should be reasonable (year between 1980-2025, not in future)
4. If end date exists, it must be after start date
5. If currentlyWorking is true, end date should be null (acceptable if missing)
6. Employment type should be a valid category

LENIENT RULES (absence is OK):
7. Missing salary/stipend is ACCEPTABLE (many offer letters don't mention salary)
8. Missing end date is ACCEPTABLE for current positions
9. Missing salary slips is ACCEPTABLE (they're optional documents)

RETURN THIS JSON FORMAT:

{
  "valid": true or false,
  "confidence": "high" or "medium" or "low",
  "reason": "Brief explanation"
}

DECISION LOGIC:
- valid: true if rules 1-2 are met AND no critical issues with 3-6
- confidence: "high" if all data looks good, "medium" if some fields missing but acceptable, "low" if data seems suspicious
- Mark as INVALID only if: missing company/title, dates are impossible, or data looks fake

NOW VERIFY AND RETURN JSON:`;

    const providers = [
      { name: "groq-primary", type: "groq", primary: true },
      { name: "groq-secondary", type: "groq", primary: false },
      {
        name: "openrouter-gpt-oss-120b",
        type: "openrouter",
        model: "openai/gpt-oss-120b",
      },
      {
        name: "openrouter-deepseek-chimera",
        type: "openrouter",
        model: "tngtech/deepseek-r1t2-chimera:free",
      },
    ];

    let lastError;

    for (const provider of providers) {
      try {
        let rawText = "";

        if (provider.type === "groq") {
          rawText = await callGroqVerifier(
            provider.primary,
            prompt,
            maxRetries,
            timeout
          );
        } else if (provider.type === "openrouter") {
          rawText = await callOpenRouterTextModel(provider.model, prompt);
        } else {
          throw new Error(`Unknown verification provider: ${provider.name}`);
        }

        if (!rawText) throw new Error("Empty response from AI");

        console.log(
          `🔍 Verification response via ${provider.name}: ${rawText.slice(
            0,
            200
          )}...`
        );

        const result = safeJsonParse(rawText);

        if (!result || typeof result.valid !== "boolean") {
          console.error(
            `❌ Invalid verification response from ${provider.name}:`,
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
          `✅ Work verification via ${provider.name}: ${
            verification.valid ? "VALID" : "INVALID"
          } (${verification.confidence} confidence, ${duration}ms)`
        );
        console.log(`📝 Reason: ${verification.reason}`);

        return verification;
      } catch (err) {
        lastError = err;
        console.warn(
          `⚠️ Provider ${provider.name} failed for verification: ${err.message}`
        );
      }
    }

    // If all providers fail, throw and let catch block apply lenient fallback
    throw lastError || new Error("All verification providers failed");
  } catch (error) {
    console.error("❌ Work verification failed:", error.message);

    // Fallback verification - Be lenient, extraction > verification
    const hasBasicInfo = workData.companyName && workData.jobTitle;

    return {
      valid: Boolean(hasBasicInfo),
      confidence: "medium",
      reason: hasBasicInfo
        ? "Verification service unavailable, basic validation passed"
        : `Verification error: ${error.message}`,
    };
  }
}

module.exports = { verifyWorkExperienceInfo };
