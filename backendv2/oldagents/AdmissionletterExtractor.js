// agents/AdmissionletterExtractor.js

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const config = require("../config/config");

// ============================================================================
// MODEL INITIALIZATION
// ============================================================================

const geminiModel = new ChatGoogleGenerativeAI({
  apiKey: config.ai.gemeniApiKey,
  model: "gemini-2.5-flash",
  temperature: 0,
  maxOutputTokens: 4096, // Increased for better extraction
  timeout: 45000, // Increased timeout
});

const groqModel = new ChatGroq({
  apiKey: config.ai.groqApiKey,
  model: "openai/gpt-oss-120b",
  temperature: 0.2,
  maxTokens: 2048, // Increased for detailed analysis
  timeout: 45000,
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Enhanced JSON extractor with better error handling and validation
 * @param {string} text - Raw text response from AI model
 * @returns {Object} Parsed JSON object
 */
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid response text: expected non-empty string");
  }

  // Remove markdown code fences and language identifiers
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```javascript\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Extract JSON object boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error(
      "❌ No valid JSON object found. Text preview:",
      cleaned.slice(0, 500)
    );
    throw new Error("No JSON object boundaries found in response");
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();

  // Attempt to parse with helpful error messages
  try {
    const parsed = JSON.parse(cleaned);

    // Validate it's an object and not null
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Parsed result is not a valid object");
    }

    return parsed;
  } catch (err) {
    console.error("❌ JSON parsing failed");
    console.error("Raw slice (first 500 chars):", cleaned.slice(0, 500));
    console.error("Parse error:", err.message);
    throw new Error(`JSON parsing failed: ${err.message}`);
  }
}

/**
 * Extract text content from various response formats
 * @param {*} response - AI model response
 * @returns {string} Extracted text
 */
function extractTextFromResponse(response) {
  try {
    if (!response) return "";
    if (typeof response === "string") return response;

    // Handle array of content parts
    if (Array.isArray(response.content)) {
      const text = response.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part?.text) return part.text;
          if (part?.content) return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
      if (text) return text;
    }

    // Handle string content
    if (response.content && typeof response.content === "string") {
      return response.content;
    }

    // Handle nested text properties
    if (response.content?.text) return response.content.text;
    if (response.text) return response.text;

    // Last resort: stringify the object
    if (typeof response === "object") {
      console.warn("⚠️ Stringifying unknown response format");
      return JSON.stringify(response);
    }

    return "";
  } catch (err) {
    console.error("❌ Error extracting text from response:", err.message);
    return "";
  }
}

/**
 * Validate extracted data against schema
 * @param {Object} data - Extracted data to validate
 * @returns {Object} Validated and sanitized data
 */
function validateExtractedData(data) {
  const validated = {
    universityName:
      typeof data.universityName === "string" ? data.universityName : null,
    programName: typeof data.programName === "string" ? data.programName : null,
    intakeTerm: ["Fall", "Spring", "Summer", "Winter"].includes(data.intakeTerm)
      ? data.intakeTerm
      : null,
    intakeYear:
      typeof data.intakeYear === "number" &&
      data.intakeYear >= 2020 &&
      data.intakeYear <= 2030
        ? data.intakeYear
        : null,
    country: typeof data.country === "string" ? data.country : null,
    issuesFound: Array.isArray(data.issuesFound) ? data.issuesFound : [],
    universityScore:
      typeof data.universityScore === "number" &&
      data.universityScore >= 0 &&
      data.universityScore <= 100
        ? data.universityScore
        : 50,
    riskLevel: ["low", "medium", "high"].includes(data.riskLevel)
      ? data.riskLevel
      : "medium",
    summary:
      typeof data.summary === "string"
        ? data.summary.slice(0, 150)
        : "Summary unavailable",
  };

  return validated;
}

/**
 * Create fallback data when extraction fails
 * @param {string} reason - Reason for fallback
 * @returns {Object} Fallback data structure
 */
function createFallbackData(reason = "AI extraction failed") {
  return {
    universityName: null,
    programName: null,
    intakeTerm: null,
    intakeYear: null,
    country: null,
    issuesFound: [`${reason} - manual review required`],
    universityScore: 50,
    riskLevel: "medium",
    summary: "Extraction failed, please review manually",
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze admission/offer letter from Cloudinary URL
 * @param {Object} params - Analysis parameters
 * @param {string} params.cloudinaryUrl - URL of the document
 * @param {string} params.fileType - Type of file (image/pdf)
 * @returns {Promise<Object>} Extracted and analyzed data
 */
async function analyzeAdmissionLetter({ cloudinaryUrl, fileType = "image" }) {
  // ========== VALIDATION ==========
  if (!cloudinaryUrl || typeof cloudinaryUrl !== "string") {
    throw new Error("Valid Cloudinary URL is required");
  }

  if (!config.ai.gemeniApiKey) {
    throw new Error("Gemini API key is not configured");
  }

  if (!config.ai.groqApiKey) {
    console.warn(
      "⚠️ Groq API key not configured - risk analysis will use fallback"
    );
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📄 ANALYZING ${fileType.toUpperCase()} DOCUMENT`);
  console.log(`🔗 URL: ${cloudinaryUrl.substring(0, 80)}...`);
  console.log(`${"=".repeat(80)}\n`);

  // ========== STEP 1: GEMINI STRUCTURED EXTRACTION ==========
  const geminiPrompt = `You are an expert document analyzer specializing in university admission and offer letters.

**TASK**: Extract structured information from this university admission/offer letter.

**DOCUMENT DETAILS**:
- URL: ${cloudinaryUrl}
- Type: ${fileType}

**OUTPUT FORMAT**: Return ONLY a valid JSON object (no markdown, no code blocks, no explanations).

**REQUIRED JSON SCHEMA**:
{
  "universityName": "string (full official university name) or null",
  "programName": "string (complete program/course name) or null",
  "intakeTerm": "Fall" | "Spring" | "Summer" | "Winter" | null,
  "intakeYear": number (4-digit year between 2020-2030) or null,
  "country": "string (full country name) or null",
  "issuesFound": ["array of specific concerns, red flags, or anomalies"],
  "universityScore": number (0-100, credibility score),
  "riskLevel": "low" | "medium" | "high",
  "summary": "string (one-sentence summary, max 100 characters)"
}

**EXTRACTION RULES**:
1. Set fields to null if information is not clearly visible
2. issuesFound must be an empty array [] if no issues detected
3. universityScore: 80-100 = reputable, 50-79 = average, 0-49 = questionable
4. riskLevel: Consider document authenticity, university reputation, clarity
5. summary: Must be under 100 characters, focus on key takeaway

**IMPORTANT**: Return ONLY the JSON object. No preamble, no markdown formatting.`;

  let geminiJson;
  const startTimeGemini = Date.now();

  try {
    console.log("🤖 Invoking Gemini API for document extraction...");

    const geminiRes = await geminiModel.invoke([
      new HumanMessage({ content: geminiPrompt }),
    ]);

    const responseText = extractTextFromResponse(geminiRes);
    const geminiDuration = Date.now() - startTimeGemini;

    console.log(`✅ Gemini response received (${geminiDuration}ms)`);
    console.log(`📏 Response length: ${responseText.length} characters`);
    console.log(`📝 Preview (first 300 chars): ${responseText.slice(0, 300)}`);

    geminiJson = extractJSON(responseText);
    geminiJson = validateExtractedData(geminiJson);

    console.log("✅ Gemini extraction successful");
    console.log(`   University: ${geminiJson.universityName || "Not found"}`);
    console.log(`   Program: ${geminiJson.programName || "Not found"}`);
    console.log(`   Issues: ${geminiJson.issuesFound.length} found`);
  } catch (error) {
    const geminiDuration = Date.now() - startTimeGemini;
    console.error(`❌ Gemini extraction failed after ${geminiDuration}ms`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack?.slice(0, 200)}`);

    geminiJson = createFallbackData("Gemini extraction error");
  }

  // ========== STEP 2: GROQ RISK ANALYSIS ==========
  const groqPrompt = `You are a university admission risk assessment specialist.

**TASK**: Analyze the following extracted admission letter data and provide a comprehensive risk assessment.

**EXTRACTED DATA**:
${JSON.stringify(geminiJson, null, 2)}

**OUTPUT FORMAT**: Return ONLY a valid JSON object (no markdown, no code blocks).

**REQUIRED JSON SCHEMA**:
{
  "universityScore": number (0-100, overall credibility),
  "riskLevel": "low" | "medium" | "high",
  "summary": "string (concise risk analysis, max 150 characters)"
}

**ASSESSMENT CRITERIA**:
- University reputation and accreditation
- Document authenticity indicators
- Completeness of information
- Any red flags or inconsistencies
- Geographic and institutional factors

**SCORING GUIDE**:
- 80-100: Highly reputable institution, low risk
- 60-79: Established institution, medium risk
- 40-59: Limited information, higher risk
- 0-39: Significant concerns, high risk

**IMPORTANT**: Keep summary under 150 characters. Return ONLY JSON.`;

  let groqJson;
  const startTimeGroq = Date.now();

  try {
    console.log("\n🤖 Invoking Groq API for risk analysis...");

    const groqRes = await groqModel.invoke([
      new HumanMessage({ content: groqPrompt }),
    ]);

    const responseText = extractTextFromResponse(groqRes);
    const groqDuration = Date.now() - startTimeGroq;

    console.log(`✅ Groq response received (${groqDuration}ms)`);
    console.log(`📏 Response length: ${responseText.length} characters`);

    groqJson = extractJSON(responseText);
    groqJson = validateExtractedData(groqJson);

    console.log("✅ Groq risk analysis successful");
    console.log(`   Risk Level: ${groqJson.riskLevel}`);
    console.log(`   Score: ${groqJson.universityScore}/100`);
  } catch (error) {
    const groqDuration = Date.now() - startTimeGroq;
    console.warn(`⚠️ Groq analysis failed after ${groqDuration}ms`);
    console.warn(`   Error: ${error.message}`);
    console.warn(`   Using Gemini scores as fallback`);

    groqJson = {
      universityScore: geminiJson.universityScore,
      riskLevel: geminiJson.riskLevel,
      summary: "Risk analysis unavailable; based on extraction only",
    };
  }

  // ========== STEP 3: MERGE AND RETURN RESULTS ==========
  const finalResult = {
    // Core extracted fields
    universityName: geminiJson.universityName || "Unknown",
    programName: geminiJson.programName || "Unknown",
    intakeTerm: geminiJson.intakeTerm,
    intakeYear: geminiJson.intakeYear,
    country: geminiJson.country,

    // Risk assessment
    issuesFound: geminiJson.issuesFound,
    universityScore: groqJson.universityScore,
    riskLevel: groqJson.riskLevel,

    // Summaries
    geminiSummary: geminiJson.summary || "",
    groqSummary: groqJson.summary || "",

    // Raw extraction data
    extractedFields: geminiJson,

    // Metadata
    metadata: {
      analyzedAt: new Date().toISOString(),
      fileType,
      cloudinaryUrl: cloudinaryUrl.substring(0, 100) + "...",
      modelsUsed: ["gemini-2.5-flash", "openai/gpt-oss-120b"],
    },
  };

  console.log(`\n${"=".repeat(80)}`);
  console.log("✅ ANALYSIS COMPLETE");
  console.log(`   University: ${finalResult.universityName}`);
  console.log(`   Risk Level: ${finalResult.riskLevel.toUpperCase()}`);
  console.log(`   Score: ${finalResult.universityScore}/100`);
  console.log(`   Issues: ${finalResult.issuesFound.length}`);
  console.log(`${"=".repeat(80)}\n`);

  return finalResult;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  analyzeAdmissionLetter,
  extractJSON,
  extractTextFromResponse,
  validateExtractedData,
  createFallbackData,
};
