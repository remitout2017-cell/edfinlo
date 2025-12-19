// agents/workExperienceExtractionAgent.js

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const config = require("../config/config");

// Use global fetch if available (Node 18+), otherwise node-fetch
const fetch = global.fetch || require("node-fetch");

let geminiPrimary = null;
let geminiSecondary = null;
let clientLock = false;

async function getGeminiClient(primary = true) {
  if (primary) {
    if (geminiPrimary && !clientLock) return geminiPrimary;
  } else {
    if (geminiSecondary && !clientLock) return geminiSecondary;
  }

  if (clientLock) {
    while (clientLock) {
      // wait until other initializer finishes
      await new Promise((r) => setTimeout(r, 10));
    }
    return primary ? geminiPrimary : geminiSecondary;
  }

  clientLock = true;
  try {
    const key = primary
      ? config.ai.gemeniApiKey
      : config.ai.gemeniApiKey2 || process.env.GEMENI_API_KEY2;

    if (!key) {
      throw new Error(
        primary ? "GEMENI_API_KEY missing" : "GEMENI_API_KEY2 missing"
      );
    }

    const client = new ChatGoogleGenerativeAI({
      apiKey: key,
      model: "gemini-2.5-flash-lite", // vision model
      temperature: 0.1,
      maxOutputTokens: 2048,
      timeout: 30000,
    });

    if (primary) {
      geminiPrimary = client;
      console.log("✅ Gemini PRIMARY client initialized for work experience");
    } else {
      geminiSecondary = client;
      console.log("✅ Gemini SECONDARY client initialized for work experience");
    }

    return client;
  } finally {
    clientLock = false;
  }
}

// Optimize image - NOW ONLY SUPPORTS JPG/PNG
async function optimizeImage(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png"];

    if (!allowed.includes(ext)) {
      throw new Error(
        "Unsupported file type for AI extraction. Please upload JPG or PNG images only."
      );
    }

    const stats = await fs.stat(filePath);

    // If already small, don't recompress
    if (stats.size <= 500 * 1024) {
      return await fs.readFile(filePath);
    }

    const optimized = await sharp(filePath)
      .resize(2048, 2048, {
        // Increased resolution for better OCR
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90, mozjpeg: true }) // Higher quality
      .toBuffer();

    const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);

    console.log(
      `📉 Work doc optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
        optimized.length / 1024
      ).toFixed(0)}KB (${reduction}% reduction)`
    );

    return optimized;
  } catch (error) {
    console.warn(`⚠️ Optimization error: ${error.message}`);

    // If optimization fails, read original
    if (error.message.includes("Unsupported file type")) {
      throw error;
    }

    return await fs.readFile(filePath);
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .trim()
    .replace(/^[^{]*(\{.*\})/s, "$1")
    .replace(/(\{.*\})\s*[^}]*$/s, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match);
      } catch {
        // ignore
      }
    }
    return null;
  }
}

// Extract text from response (Gemini-style) OR accept plain string
function extractTextFromResponse(response) {
  try {
    if (typeof response === "string") return response;

    if (response?.content) {
      if (typeof response.content === "string") return response.content;

      if (Array.isArray(response.content)) {
        return response.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part?.text) return part.text;
            if (part?.content) return part.content;
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }

      if (response.content.text) return response.content.text;
    }

    if (response?.text) return response.text;

    return "";
  } catch (error) {
    console.error("❌ Error extracting text:", error.message);
    return "";
  }
}

// OpenRouter vision call (Nemotron) – returns plain text
async function callOpenRouterVision(messageContent) {
  if (!config.ai.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  const res = await fetch(`${config.ai.openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.openRouterApiKey}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter
      "HTTP-Referer": config.frontendUrl || "https://localhost",
      "X-Title": "work-experience-extraction",
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter vision error: ${res.status} ${res.statusText} ${body}`
    );
  }

  const json = await res.json();
  const choice = json.choices && json.choices;
  if (!choice) {
    throw new Error("OpenRouter vision returned no choices");
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

// Call a single provider (Gemini primary/secondary or OpenRouter) and return raw text
async function callExtractionProvider(provider, message, maxRetries) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (provider === "gemini-primary" || provider === "gemini-secondary") {
        const client = await getGeminiClient(provider === "gemini-primary");

        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Extraction timeout")), 30000)
          ),
        ]);

        const rawText = extractTextFromResponse(response);
        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Empty response from AI");
        }

        return rawText;
      }

      if (provider === "openrouter-nemotron") {
        const rawText = await callOpenRouterVision(message.content);
        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Empty response from OpenRouter vision");
        }
        return rawText;
      }

      throw new Error(`Unknown extraction provider: ${provider}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `⚠️ ${provider} extraction attempt ${
            attempt + 1
          } failed, retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error(`Provider ${provider} failed`);
}

/**
 * Extract work experience info from documents
 * @param {Object} filePaths - File paths object
 * @param {Object} options - Options
 */
async function extractWorkExperienceInfo(filePaths, options = {}) {
  const startTime = Date.now();
  const { maxRetries = 2 } = options;

  try {
    const validPaths = Object.entries(filePaths)
      .filter(([, fp]) => fp && typeof fp === "string")
      .map(([key, fp]) => ({ key, fp: path.resolve(fp) }));

    if (validPaths.length === 0) {
      throw new Error("No valid image paths provided");
    }

    console.log(
      `📸 Processing ${validPaths.length} work experience document(s)...`
    );

    // Build image parts (JPG/PNG only)
    const imagePromises = validPaths.map(async ({ fp }) => {
      const buffer = await optimizeImage(fp); // will throw on non-image
      const lower = fp.toLowerCase();
      const mimeType = lower.endsWith(".png") ? "image/png" : "image/jpeg";

      return {
        type: "image_url",
        image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
      };
    });

    let imageParts;
    try {
      imageParts = await Promise.all(imagePromises);
    } catch (err) {
      if (err.message.includes("Unsupported file type")) {
        throw new Error(err.message);
      }
      console.error("❌ Failed to prepare images for AI:", err.message);
      throw new Error("Failed to prepare documents for AI extraction");
    }

    // Original detailed prompt (unchanged)
    const prompt = `You are an expert document analyzer. Extract work experience information from the employment document(s) shown in the image(s).

DOCUMENT TYPES YOU MAY SEE:
- Offer Letter: Shows company offering a position
- Experience Letter/Certificate: Shows completed work tenure
- Appointment Letter: Shows formal job appointment details
- Joining Letter: Confirms joining date and position
- Relieving Letter: Shows employee leaving date
- Employee ID Card: Shows company and employee details
- Salary Slips: Shows monthly compensation

EXTRACTION INSTRUCTIONS:
1. Company Name: Look in letterhead, header, footer, "From", "For", signatures. Include full legal name.
2. Job Title/Position: Look for "Position", "Role", "Designation", "Post", "Title".
3. Employment Type: Determine from context (internship, full_time, part_time, contract, etc.).
4. Dates:
   - Start Date: "Joining Date", "Start Date", "From Date", etc.
   - End Date: "Relieving Date", "Last Working Day", "To Date", etc.
   - If "Present" or "Current" → currentlyWorking: true
5. Salary/Stipend: Look for "Salary", "CTC", "Stipend", "Package".
6. Paid/Unpaid: If explicitly "unpaid" or "volunteer" → isPaid: false.

RETURN ONLY THIS JSON FORMAT (no explanation, no markdown, pure JSON):

{
  "companyName": "Exact company name from document",
  "jobTitle": "Exact job title/position",
  "employmentType": "full_time",
  "startDate": "DD/MM/YYYY",
  "endDate": "DD/MM/YYYY or null",
  "currentlyWorking": false,
  "isPaid": true,
  "stipendAmount": 50000,
  "salarySlips": []
}

CRITICAL RULES:
- You MUST extract companyName and jobTitle if they exist in the document.
- Date format MUST be DD/MM/YYYY.
- If salary is annual (CTC), convert to monthly by dividing by 12.
- Set currentlyWorking: true ONLY if explicitly current/present/ongoing.
- Use null for fields you cannot find.
NOW ANALYZE THE DOCUMENT(S) AND RETURN JSON:`;

    const message = new HumanMessage({
      content: [{ type: "text", text: prompt }, ...imageParts],
    });

    const providers = [
      "gemini-primary",
      "gemini-secondary",
      "openrouter-nemotron",
    ];

    let lastError;

    for (const provider of providers) {
      try {
        console.log(`🧠 Using provider: ${provider} for work extraction...`);
        const rawText = await callExtractionProvider(
          provider,
          message,
          maxRetries
        );

        console.log(`📄 AI Response preview: ${rawText.substring(0, 200)}...`);

        const result = safeJsonParse(rawText);

        if (!result) {
          console.error(
            `❌ Failed to parse AI response from ${provider}:`,
            rawText.slice(0, 500)
          );
          throw new Error("Invalid JSON from AI");
        }

        // Normalize output (unchanged)
        const workData = {
          companyName: result.companyName || null,
          jobTitle: result.jobTitle || null,
          employmentType: result.employmentType || "full_time",
          startDate: result.startDate || null,
          endDate: result.endDate || null,
          currentlyWorking: Boolean(result.currentlyWorking),
          isPaid: result.isPaid !== false, // Default to true
          stipendAmount: result.stipendAmount || null,
          salarySlips: Array.isArray(result.salarySlips)
            ? result.salarySlips
            : [],
        };

        const duration = Date.now() - startTime;
        const fieldCount = Object.values(workData).filter(
          (v) =>
            v !== null &&
            v !== false &&
            (Array.isArray(v) ? v.length > 0 : true)
        ).length;

        console.log(
          `✅ Work experience extraction completed via ${provider}: ${fieldCount} fields (${duration}ms)`
        );
        console.log(`📊 Extracted data:`, JSON.stringify(workData, null, 2));

        return workData;
      } catch (err) {
        lastError = err;
        console.warn(
          `⚠️ Provider ${provider} failed for work extraction: ${err.message}`
        );
      }
    }

    throw lastError || new Error("All extraction providers failed");
  } catch (error) {
    console.error("❌ Work experience extraction failed:", error.message);
    throw error;
  }
}

module.exports = { extractWorkExperienceInfo };
