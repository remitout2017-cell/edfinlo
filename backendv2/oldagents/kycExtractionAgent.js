// agents/kycExtractionAgent.js
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config/config");
const sharp = require("sharp");

let gemini = null;
let clientLock = false;
let cachedContent = null;

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
      temperature: 0.1,
      maxOutputTokens: 2000,
      timeout: 30000,
    });
    console.log("✅ Gemini client initialized");
    return gemini;
  } finally {
    clientLock = false;
  }
}

async function optimizeImage(filePath) {
  try {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size <= 500 * 1024) {
        const buffer = await fs.readFile(filePath);
        return buffer;
      }
      const optimized = await sharp(filePath)
        .resize(1920, 1920, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      const reduction = ((1 - optimized.length / stats.size) * 100).toFixed(1);
      console.log(
        `📉 Image optimized: ${(stats.size / 1024).toFixed(0)}KB → ${(
          optimized.length / 1024
        ).toFixed(0)}KB (${reduction}% reduction)`
      );

      return optimized;
    } catch (error) {
      console.warn(
        `⚠️ Optimization failed for ${filePath}, using original:`,
        error.message
      );
      return await fs.readFile(filePath);
    }
  } catch (error) {
    console.error(`❌ Failed to read image ${filePath}:`, error.message);
    throw error;
  }
}

function safeJsonParse(text) {
  if (!text?.trim()) return null;
  let cleaned = text
    .trim()
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/^[^{]*/, "") // Remove text before first {
    .replace(/[^}]*$/, ""); // Remove text after last }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (error) {
        return null;
      }
    }
  }
}

async function extractKycInfo(filePaths, options = {}) {
  const startTime = Date.now();
  const {
    enableCaching = true, // Enable context caching for cost reduction
    maxRetries = 2, // Retry on failure
    batchMode = false, // Process all images in single call
  } = options;
  try {
    const validPaths = Object.entries(filePaths)
      .filter(([, fp]) => fp && typeof fp === "string")
      .map(([key, fp]) => ({ key, fp: path.resolve(fp) }));

    if (validPaths.length === 0) {
      throw new Error("No valid image paths provided");
    }

    const imagePromises = validPaths.map(async ({ key, fp }) => {
      const buffer = await optimizeImage(fp);
      if (buffer.length > 15 * 1024 * 1024) {
        throw new Error(
          `Image too large after optimization: ${key} (${Math.round(
            buffer.length / 1024 / 1024
          )}MB)`
        );
      }
      return {
        type: "image_url",
        image_url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      };
    });
    const imageParts = await Promise.all(imagePromises);

    const prompt = `Extract KYC data as JSON. Return ONLY valid JSON, no markdown:
{
  "aadhaarNumber": "string or null",
  "aadhaarName": "string or null",
  "aadhaarDOB": "YYYY-MM-DD or null",
  "aadhaarAddress": "string or null",
  "panNumber": "string or null",
  "panName": "string or null",
  "panDOB": "YYYY-MM-DD or null",
  "passportNumber": "string or null",
  "passportName": "string or null",
  "passportDOB": "YYYY-MM-DD or null",
  "passportIssueDate": "YYYY-MM-DD or null",
  "passportExpiryDate": "YYYY-MM-DD or null"
}

Rules:
- Extract visible text from images
- Use null for missing fields
- Format dates as YYYY-MM-DD
- Return valid JSON only`;

    const client = await getGeminiClient();
    const message = new HumanMessage({
      content: [{ type: "text", text: prompt }, ...imageParts],
    });
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Gemini timeout")), 30000)
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
        if (!rawText) throw new Error("Empty response from Gemini");
        const result = safeJsonParse(rawText);
        if (!result) {
          console.error("❌ Gemini response:", rawText.slice(0, 300));
          throw new Error("Invalid JSON from Gemini");
        }

        // Normalize output
        const kycData = {
          aadhaarNumber: result.aadhaarNumber || null,
          aadhaarName: result.aadhaarName || null,
          aadhaarDOB: result.aadhaarDOB || null,
          aadhaarAddress: result.aadhaarAddress || null,
          panNumber: result.panNumber || null,
          panName: result.panName || null,
          panDOB: result.panDOB || null,
          passportNumber: result.passportNumber || null,
          passportName: result.passportName || null,
          passportDOB: result.passportDOB || null,
          passportIssueDate: result.passportIssueDate || null,
          passportExpiryDate: result.passportExpiryDate || null,
        };

        const extractedCount = Object.values(kycData).filter(Boolean).length;
        const duration = Date.now() - startTime;

        console.log(
          `✅ KYC extracted: ${validPaths.length} images → ${extractedCount} fields (${duration}ms)`
        );

        return kycData;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(
            `⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
        throw lastError;
      }
    }
  } catch (error) {
    console.error(`❌ KYC extraction failed:`, error.message);
    throw error;
  }
}

async function extractKycBatch(documentSets) {
  const results = [];

  // Process in parallel with concurrency limit
  const concurrency = 3;
  for (let i = 0; i < documentSets.length; i += concurrency) {
    const batch = documentSets.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((docs) => extractKycInfo(docs))
    );
    results.push(...batchResults);
  }

  return results;
}

module.exports = { extractKycInfo, extractKycBatch };
