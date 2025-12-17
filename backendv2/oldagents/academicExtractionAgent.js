// agents/academicExtractionAgent.js

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const config = require("../config/config");

let gemini = null;
let clientLock = false;

async function getGeminiClient() {
  if (gemini && !clientLock) return gemini;

  if (clientLock) {
    while (clientLock) await new Promise((r) => setTimeout(r, 10));
    return gemini;
  }

  clientLock = true;
  try {
    if (!config.ai.gemeniApiKey) throw new Error("GEMENI_API_KEY missing");

    gemini = new ChatGoogleGenerativeAI({
      apiKey: config.ai.gemeniApiKey,
      model: "gemini-2.5-flash",
      temperature: 0,
      maxOutputTokens: 2048,
      timeout: 30000,
    });

    console.log("✅ Gemini client initialized for academic extraction");
    return gemini;
  } finally {
    clientLock = false;
  }
}

// Optimize image before AI processing
async function optimizeImage(filePath) {
  try {
    const stats = await fs.stat(filePath);

    // Skip if already small
    if (stats.size <= 300 * 1024) {
      return await fs.readFile(filePath);
    }

    const optimized = await sharp(filePath)
      .resize(1920, 1920, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);
    console.log(
      `📉 Academic doc optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
        optimized.length / 1024
      ).toFixed(0)}KB (${reduction}% reduction)`
    );

    return optimized;
  } catch (error) {
    console.warn(`⚠️ Optimization failed for ${filePath}, using original`);
    return await fs.readFile(filePath);
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;

  // Remove markdown code blocks
  let cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/g, "")
    .replace(/```$/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON object
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
 * ✅ FIXED: Extract text from Gemini response (robust handling)
 */
function extractTextFromResponse(response) {
  try {
    // Handle direct string response
    if (typeof response === "string") {
      return response;
    }

    // ✅ Handle LangChain AIMessage response
    if (response?.content) {
      // If content is a string (most common)
      if (typeof response.content === "string") {
        return response.content;
      }

      // If content is an array of parts
      if (Array.isArray(response.content)) {
        const textParts = response.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part?.text) return part.text;
            if (part?.content) return part.content;
            // ✅ Handle LangChain text parts
            if (part?.type === "text" && part?.text) return part.text;
            return "";
          })
          .filter(Boolean);

        return textParts.join("\n");
      }

      // If content is an object with text
      if (response.content.text) {
        return response.content.text;
      }
    }

    // Handle response with text property
    if (response?.text) {
      return response.text;
    }

    // ✅ Handle LangChain response with kwargs
    if (response?.kwargs?.content) {
      if (typeof response.kwargs.content === "string") {
        return response.kwargs.content;
      }
      if (Array.isArray(response.kwargs.content)) {
        return response.kwargs.content
          .map(part => part?.text || part?.content || "")
          .filter(Boolean)
          .join("\n");
      }
    }

    // Fallback: stringify
    if (typeof response === "object") {
      console.warn("⚠️ Unexpected response structure:", Object.keys(response));
      return JSON.stringify(response);
    }

    return "";
  } catch (error) {
    console.error("❌ Error extracting text from response:", error.message);
    return "";
  }
}

/**
 * Get education-specific prompt
 */
function getPromptForEducationType(educationType) {
  const isSchool = educationType === "class10" || educationType === "class12";

  let fields = `{
  "institutionName": "string or null",
  "boardUniversity": "string or null",
  "yearOfPassing": "number (4 digits) or null",
  "percentage": "number (0-100) or null",
  "cgpa": "number (0-10) or null",
  "grade": "string or null"`;

  if (educationType === "class12") {
    fields += `,
  "stream": "string or null"`;
  }

  if (!isSchool) {
    fields += `,
  "courseName": "string or null",
  "specialization": "string or null"`;
  }

  fields += `
}`;

  return `You are an expert at extracting information from academic documents. Analyze the provided ${educationType} marksheet(s) and extract the following information.

Return ONLY a valid JSON object with these exact fields (use null for missing data):

${fields}

IMPORTANT RULES:
- Return ONLY the JSON object, no markdown, no explanations, no code blocks
- institutionName may not be visible on Class 10/12 marksheets - use null if not found
- Extract percentage as decimal number (e.g., 85.5 not "85.5%")
- Year must be 4 digits (e.g., 2020)
- CGPA is optional, use null if not present
- Use null for any missing field
- Do not add any extra fields
- Ensure the JSON is valid and properly formatted`;
}

/**
 * Extract academic information from marksheets
 * @param {Array} filePaths - Array of file paths
 * @param {string} educationType - Type of education (class10, class12, bachelor, etc.)
 * @param {Object} options - Configuration options
 */
async function extractAcademicInfo(
  filePaths,
  educationType = "general",
  options = {}
) {
  const startTime = Date.now();
  const { maxRetries = 2 } = options;

  try {
    const validPaths = filePaths.filter((fp) => fp && typeof fp === "string");

    if (validPaths.length === 0) {
      throw new Error("No valid image paths provided");
    }

    console.log(
      `📸 Processing ${validPaths.length} ${educationType} document(s)...`
    );

    // Optimize images in parallel
    const imagePromises = validPaths.map(async (fp) => {
      const buffer = await optimizeImage(path.resolve(fp));
      const mimeType = fp.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";

      return {
        type: "image_url",
        image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
      };
    });

    const imageParts = await Promise.all(imagePromises);

    // Get optimized prompt
    const prompt = getPromptForEducationType(educationType);

    const client = await getGeminiClient();

    const message = new HumanMessage({
      content: [{ type: "text", text: prompt }, ...imageParts],
    });

    // Retry logic with exponential backoff
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Extraction attempt ${attempt + 1}/${maxRetries + 1}...`);

        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Extraction timeout (30s)")), 30000)
          ),
        ]);

        // ✅ FIXED: Robust text extraction
        const rawText = extractTextFromResponse(response);

        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Empty response from AI");
        }

        console.log(`📄 AI Response preview (${rawText.length} chars): ${rawText.substring(0, 200)}...`);

        const result = safeJsonParse(rawText);

        if (!result || typeof result !== "object") {
          console.error(
            "❌ Failed to parse AI response:",
            rawText.slice(0, 500)
          );
          throw new Error("Invalid JSON from AI");
        }

        // Validate required structure
        const hasValidData = Object.values(result).some(
          val => val !== null && val !== undefined && val !== ""
        );

        if (!hasValidData) {
          throw new Error("No data extracted from document");
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Academic extraction completed in ${duration}ms`);
        console.log(`📊 Extracted data:`, JSON.stringify(result, null, 2));

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `⚠️ Extraction attempt ${attempt + 1} failed (${
              error.message
            }), retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Extraction failed after all retries");
  } catch (error) {
    console.error("❌ Academic extraction failed:", error.message);
    console.error("Stack trace:", error.stack);
    throw error;
  }
}

module.exports = { extractAcademicInfo };