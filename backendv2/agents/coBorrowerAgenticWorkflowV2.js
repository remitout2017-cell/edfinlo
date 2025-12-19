// agents/coBorrowerAgenticWorkflowV2.js - UPDATED VERSION WITH BETTER PDF HANDLING
// 🚀 Enhanced with automatic fallback and rate limit protection

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const { fromPath } = require("pdf2pic");
const config = require("../config/config");
const EventEmitter = require("events");

// ============================================================================
// RATE LIMIT PROTECTION
// ============================================================================

class RateLimiter {
  constructor() {
    this.lastCallTime = 0;
    this.callCount = 0;
    this.minDelay = 2000; // 2 seconds between calls
    this.maxCallsPerMinute = 15; // Conservative limit
    this.callHistory = [];
  }

  async waitIfNeeded() {
    const now = Date.now();

    // Remove calls older than 1 minute
    this.callHistory = this.callHistory.filter((time) => now - time < 60000);

    // Check if we're approaching rate limit
    if (this.callHistory.length >= this.maxCallsPerMinute) {
      const oldestCall = this.callHistory[0];
      const waitTime = 60000 - (now - oldestCall) + 1000; // Wait until oldest call is 1min old + buffer

      if (waitTime > 0) {
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Enforce minimum delay between calls
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelay) {
      const delay = this.minDelay - timeSinceLastCall;
      console.log(`⏳ Throttling: waiting ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastCallTime = Date.now();
    this.callHistory.push(this.lastCallTime);
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// CONFIGURATION & INITIALIZATION
// ============================================================================

class AgentPool extends EventEmitter {
  constructor() {
    super();
    this.gemini = null;
    this.groq = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    if (!config.ai.gemeniApiKey) {
      throw new Error("GEMENI_API_KEY missing");
    }
    if (!config.ai.groqApiKey) {
      throw new Error("GROQ_API_KEY missing");
    }

    // Gemini 1.5 Flash - STABLE MODEL (better rate limits than 2.0-exp)
    this.gemini = new ChatGoogleGenerativeAI({
      apiKey: config.ai.gemeniApiKey,
      model: "gemini-2.5-flash-lite",
      temperature: 0.1,
      maxOutputTokens: 8192,
      timeout: 120000,
    });

    // Groq for fast verification (text-only)
    this.groq = new ChatGroq({
      apiKey: config.ai.groqApiKey,
      model: "groq/compound",
      temperature: 0.4,
      maxTokens: 4096,
      timeout: 30000,
    });

    this.initialized = true;
    console.log("✅ Agent pool initialized (Gemini 1.5 Flash + Groq)");
  }

  getGemini() {
    if (!this.initialized) throw new Error("Agent pool not initialized");
    return this.gemini;
  }

  getGroq() {
    if (!this.initialized) throw new Error("Agent pool not initialized");
    return this.groq;
  }
}

const agentPool = new AgentPool();

// ============================================================================
// UNIVERSAL DOCUMENT PROCESSING UTILITIES
// ============================================================================

class DocumentProcessor {
  static async getPdfPageCount(pdfPath) {
    try {
      // Simple method that doesn't require external dependencies
      const fs = require("fs");
      const buffer = fs.readFileSync(pdfPath);
      const pdfString = buffer.toString("latin1");

      // Look for /Count pattern in PDF
      const countMatch = pdfString.match(/\/Count\s+(\d+)/);
      if (countMatch) {
        const pageCount = parseInt(countMatch[1], 10);
        console.log(`📄 PDF page count via /Count pattern: ${pageCount}`);
        return pageCount;
      }

      // Alternative: count /Page objects
      const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
      if (pageMatches) {
        const pageCount = pageMatches.length;
        console.log(`📄 PDF page count via /Page objects: ${pageCount}`);
        return pageCount;
      }

      // If PDF parsing fails, try to estimate from file size
      const stats = await fs.stat(pdfPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      // Rough estimate: ~50KB per page
      const estimatedPages = Math.max(1, Math.ceil((fileSizeMB * 1024) / 50));
      console.log(
        `📄 Estimated PDF pages from file size (${fileSizeMB.toFixed(
          2
        )}MB): ${estimatedPages}`
      );

      return Math.min(estimatedPages, 50); // Cap at 50 pages
    } catch (error) {
      console.warn(`⚠️ Could not determine PDF page count: ${error.message}`);
      return 10; // Safe default
    }
  }

  static async convertPdfToImages(pdfPath, maxPages = 50) {
    try {
      const pageCount = await this.getPdfPageCount(pdfPath);
      const pagesToProcess = Math.min(pageCount, maxPages);

      console.log(
        `📄 Processing PDF: ${pageCount} total pages (will extract ${pagesToProcess})`
      );

      const images = [];

      // Check if we can use pdf2pic (requires GraphicsMagick/ImageMagick)
      let canUsePdf2Pic = false;
      try {
        // Test if ImageMagick/GraphicsMagick is available
        require("child_process").execSync("gm version || magick --version", {
          stdio: "ignore",
        });
        canUsePdf2Pic = true;
      } catch {
        console.log(
          "⚠️ ImageMagick/GraphicsMagick not found, using fallback method"
        );
      }

      if (canUsePdf2Pic) {
        // Use pdf2pic for better quality
        const density = 100;
        const width = 1200;
        const quality = 80;

        const options = {
          density,
          format: "jpeg",
          width,
          height: width * 1.414, // A4 ratio
          quality,
          preserveAspectRatio: true,
        };

        const storeAsImage = fromPath(pdfPath, options);

        // Process pages in smaller batches
        const batchSize = 3;
        for (let i = 0; i < pagesToProcess; i += batchSize) {
          const batchEnd = Math.min(i + batchSize, pagesToProcess);

          for (let page = i + 1; page <= batchEnd; page++) {
            try {
              console.log(`🔄 Converting page ${page}/${pagesToProcess}...`);

              const imagePath = await storeAsImage(page, {
                saveFilename: `page-${page}-${Date.now()}`,
                savePath: path.dirname(pdfPath),
              });

              if (imagePath && imagePath.path) {
                const buffer = await fs.readFile(imagePath.path);
                const optimizedBuffer = await sharp(buffer)
                  .resize(1200, null, {
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .jpeg({ quality: 75, progressive: true })
                  .toBuffer();

                await fs.unlink(imagePath.path).catch(() => {});

                images.push({
                  type: "image_url",
                  image_url: `data:image/jpeg;base64,${optimizedBuffer.toString(
                    "base64"
                  )}`,
                  page,
                });

                console.log(`✅ Page ${page} converted successfully`);
              }
            } catch (pageError) {
              console.warn(
                `⚠️ Failed to convert page ${page}: ${pageError.message}`
              );
              // Skip this page and continue
            }
          }
        }
      } else {
        // Fallback: Extract first and last few pages + middle page
        console.log(
          "⚠️ Using smart sampling for PDF (ImageMagick not available)"
        );

        const pagesToSample = [];

        // Always include first page
        pagesToSample.push(1);

        // Include last page if different from first
        if (pagesToProcess > 1) {
          pagesToSample.push(pagesToProcess);
        }

        // Include middle page if available
        if (pagesToProcess > 2) {
          pagesToSample.push(Math.floor(pagesToProcess / 2));
        }

        // Include additional pages for large documents
        if (pagesToProcess > 10) {
          const quarter = Math.floor(pagesToProcess / 4);
          const threeQuarter = Math.floor((3 * pagesToProcess) / 4);
          if (!pagesToSample.includes(quarter)) pagesToSample.push(quarter);
          if (!pagesToSample.includes(threeQuarter))
            pagesToSample.push(threeQuarter);
        }

        console.log(
          `📄 Smart sampling pages: ${pagesToSample
            .sort((a, b) => a - b)
            .join(", ")}`
        );

        // Try to extract text directly from PDF for these pages
        for (const pageNum of pagesToSample) {
          try {
            const pdfText = await this.extractTextFromPdfPage(pdfPath, pageNum);
            if (pdfText && pdfText.length > 50) {
              // Has meaningful text
              images.push({
                type: "text_chunk",
                text: `Page ${pageNum} content:\n${pdfText}`,
                page: pageNum,
              });
              console.log(
                `✅ Extracted text from page ${pageNum} (${pdfText.length} chars)`
              );
            }
          } catch (error) {
            console.warn(
              `⚠️ Could not extract text from page ${pageNum}: ${error.message}`
            );
          }
        }
      }

      console.log(
        `✅ PDF processing complete: ${images.length} items extracted`
      );

      if (images.length === 0) {
        console.warn(`⚠️ No content could be extracted from PDF`);
        // Return at least the first page as a placeholder
        images.push({
          type: "text_chunk",
          text: `PDF document with ${pageCount} pages. Content extraction failed.`,
          page: 1,
        });
      }

      return images;
    } catch (error) {
      console.error(`❌ PDF conversion failed for ${pdfPath}:`, error.message);
      // Return minimal representation
      return [
        {
          type: "text_chunk",
          text: `Error processing PDF: ${error.message}`,
          page: 1,
        },
      ];
    }
  }

  static async extractTextFromPdfPage(pdfPath, pageNum) {
    try {
      // Simple text extraction using pdf-parse if available
      const pdfParse = require("pdf-parse");
      const buffer = await fs.readFile(pdfPath);
      const data = await pdfParse(buffer);

      return data.text || "No text content found";
    } catch (error) {
      console.warn(`⚠️ Text extraction failed: ${error.message}`);
      return "Text extraction not available";
    }
  }

  static async processImageFile(filePath) {
    try {
      const buffer = await sharp(filePath)
        .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      return {
        type: "image_url",
        image_url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      };
    } catch (error) {
      console.error(
        `❌ Image processing failed for ${filePath}:`,
        error.message
      );
      throw error;
    }
  }

  static async processMultipleFiles(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".pdf") {
          const pdfImages = await this.convertPdfToImages(filePath);
          results.push(...pdfImages);
        } else if (
          [".jpeg", ".jpg", ".png", ".bmp", ".gif", ".webp"].includes(ext)
        ) {
          const image = await this.processImageFile(filePath);
          results.push(image);
        } else {
          console.warn(`⚠️ Unsupported file type: ${ext}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process file ${filePath}: ${error.message}`);
      }
    }

    return results;
  }

  static async categorizeAndPrepareFiles(filePaths) {
    console.log(
      `📸 Preparing ${Object.keys(filePaths).length} files for extraction...`
    );

    const categorized = {
      salarySlips: [],
      bankStatements: [],
      itrs: [],
      form16s: [],
      business: [],
    };

    let totalPages = 0;

    // Group files by type
    const filesByType = {
      salary: [],
      bank: [],
      itr: [],
      form16: [],
      business: [],
      other: [],
    };

    for (const [key, filePath] of Object.entries(filePaths)) {
      if (!filePath) continue;

      const ext = path.extname(filePath).toLowerCase();
      const keyLower = key.toLowerCase();

      // Determine file type
      if (keyLower.includes("salary")) {
        filesByType.salary.push(filePath);
      } else if (keyLower.includes("bank") || keyLower.includes("stmt")) {
        filesByType.bank.push(filePath);
      } else if (keyLower.includes("itr")) {
        filesByType.itr.push(filePath);
      } else if (keyLower.includes("form16")) {
        filesByType.form16.push(filePath);
      } else if (keyLower.includes("business")) {
        filesByType.business.push(filePath);
      } else {
        filesByType.other.push(filePath);
      }
    }

    // Process each category
    console.log("📊 File breakdown:");
    console.log(`  - Salary slips: ${filesByType.salary.length} file(s)`);
    console.log(`  - Bank statements: ${filesByType.bank.length} file(s)`);
    console.log(`  - ITR: ${filesByType.itr.length} file(s)`);
    console.log(`  - Form 16: ${filesByType.form16.length} file(s)`);
    console.log(`  - Business proof: ${filesByType.business.length} file(s)`);

    // Process salary slips
    if (filesByType.salary.length > 0) {
      categorized.salarySlips = await this.processMultipleFiles(
        filesByType.salary
      );
      totalPages += categorized.salarySlips.length;
    }

    // Process bank statements
    if (filesByType.bank.length > 0) {
      categorized.bankStatements = await this.processMultipleFiles(
        filesByType.bank
      );
      totalPages += categorized.bankStatements.length;
    }

    // Process ITR documents
    if (filesByType.itr.length > 0) {
      categorized.itrs = await this.processMultipleFiles(filesByType.itr);
      totalPages += categorized.itrs.length;
    }

    // Process Form 16 documents
    if (filesByType.form16.length > 0) {
      categorized.form16s = await this.processMultipleFiles(filesByType.form16);
      totalPages += categorized.form16s.length;
    }

    // Process business proof
    if (filesByType.business.length > 0) {
      categorized.business = await this.processMultipleFiles(
        filesByType.business
      );
      totalPages += categorized.business.length;
    }

    console.log(`✅ Total items prepared: ${totalPages}`);

    // Log detailed breakdown
    console.log("📊 Prepared items breakdown:");
    console.log(`  - Salary slip items: ${categorized.salarySlips.length}`);
    console.log(
      `  - Bank statement items: ${categorized.bankStatements.length}`
    );
    console.log(`  - ITR items: ${categorized.itrs.length}`);
    console.log(`  - Form 16 items: ${categorized.form16s.length}`);
    console.log(`  - Business proof items: ${categorized.business.length}`);

    return { categorized, totalPages };
  }
}

// ============================================================================
// UNIVERSAL EXTRACTION AGENTS WITH SMART FALLBACKS
// ============================================================================

class BaseAgent {
  static extractText(response) {
    if (typeof response === "string") return response;
    if (response?.content) {
      if (typeof response.content === "string") return response.content;
      if (Array.isArray(response.content)) {
        return response.content
          .map((part) => part.text || part.content || part)
          .filter(Boolean)
          .join("\n");
      }
    }
    return response?.text || "";
  }

  static safeJsonParse(text) {
    if (!text?.trim()) return null;

    // Clean the text
    let cleaned = text
      .trim()
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{[\}]*/, "")
      .replace(/[^}\]]*$/, "");

    // Try to parse
    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.warn("⚠️ JSON parse failed, trying to extract JSON...");

      // Try to find JSON object in text
      const jsonMatch = cleaned.match(/(\{[\s\S]*\})|(\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Continue to next attempt
        }
      }

      // Try to fix common JSON issues
      try {
        // Remove trailing commas
        const fixed = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(fixed);
      } catch {
        // Return null if all attempts fail
        console.error(
          "❌ Could not parse JSON from:",
          cleaned.substring(0, 200)
        );
        return null;
      }
    }
  }

  static async invokeWithRateLimit(client, message, agentName) {
    await rateLimiter.waitIfNeeded();
    console.log(`🤖 ${agentName} invoking AI...`);

    try {
      return await client.invoke([message]);
    } catch (error) {
      console.error(`❌ ${agentName} invocation failed:`, error.message);
      throw error;
    }
  }

  static isRateLimitError(error) {
    const errorMsg = error.message?.toLowerCase() || "";
    return (
      errorMsg.includes("rate limit") ||
      errorMsg.includes("quota exceeded") ||
      errorMsg.includes("429") ||
      errorMsg.includes("too many requests")
    );
  }

  static async handleRateLimitError(error, attempt) {
    if (this.isRateLimitError(error)) {
      // Extract wait time from error message if available
      const retryMatch = error.message?.match(/retry in (\d+\.?\d*)s/i);
      const waitTime = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000 // Add 2s buffer
        : Math.pow(2, attempt) * 5000; // Exponential backoff starting at 5s

      console.warn(`⚠️ Rate limit hit. Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return true;
    }
    return false;
  }
}

class SalarySlipAgent extends BaseAgent {
  static async extract(images) {
    if (images.length === 0) return [];

    console.log(`💰 Processing ${images.length} salary slip items...`);

    const prompt = `Extract ALL salary slip data from the provided documents. Return ONLY valid JSON array:

[
  {
    "month": "string (e.g., January, Feb, Mar, etc.)",
    "year": number (e.g., 2024, 2025)",
    "grossSalary": number,
    "netSalary": number,
    "basicSalary": number,
    "hra": number,
    "allowances": number,
    "deductions": {
      "pf": number,
      "tax": number,
      "insurance": number,
      "other": number
    },
    "employerName": "string or null",
    "documentType": "salary_slip"
  }
]

IMPORTANT:
1. Extract ALL salary slips you find (even if there are multiple in one document)
2. For missing numeric fields, use 0
3. For missing string fields, use null
4. Try to identify month and year from each slip
5. If month/year not found, use reasonable defaults`;

    try {
      const client = agentPool.getGemini();

      // If we have too many images, use a sampling strategy
      let imagesToSend = images;
      if (images.length > 10) {
        console.log(
          `📊 Too many salary slip images (${images.length}), sampling 10...`
        );
        // Take first, middle, and last images
        imagesToSend = [
          images[0],
          images[Math.floor(images.length / 3)],
          images[Math.floor((2 * images.length) / 3)],
          images[images.length - 1],
        ];
      }

      const message = new HumanMessage({
        content: [{ type: "text", text: prompt }, ...imagesToSend],
      });

      const response = await this.invokeWithRateLimit(
        client,
        message,
        "SalarySlipAgent"
      );
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (Array.isArray(result)) {
        console.log(`✅ Extracted ${result.length} salary slips`);
        return result;
      } else if (result && typeof result === "object") {
        // Single object returned instead of array
        console.log(`✅ Extracted 1 salary slip (wrapped in array)`);
        return [result];
      } else {
        console.warn("⚠️ Could not parse salary slips, returning empty array");
        return [];
      }
    } catch (error) {
      console.error("❌ Salary slip extraction failed:", error.message);

      // Fallback: return basic structure
      return images.map((_, index) => ({
        month: "Unknown",
        year: new Date().getFullYear(),
        grossSalary: 0,
        netSalary: 0,
        basicSalary: 0,
        hra: 0,
        allowances: 0,
        deductions: { pf: 0, tax: 0, insurance: 0, other: 0 },
        employerName: null,
        documentType: "salary_slip",
      }));
    }
  }
}

// In coBorrowerAgenticWorkflowV2.js, update the BankStatementAgent:

class BankStatementAgent extends BaseAgent {
  static async extract(images) {
    if (images.length === 0) return null;

    console.log(`🏦 Processing ${images.length} bank statement items...`);

    const prompt = `Analyze this bank statement and extract financial data. Return ONLY valid JSON:

{
  "accountNumber": "string or null",
  "bankName": "string or null",
  "ifscCode": "string or null",
  "accountType": "savings|current|salary",
  "statementPeriod": {
    "from": "DD/MM/YYYY or null",
    "to": "DD/MM/YYYY or null"
  },
  "monthlyData": [
    {
      "month": "string (e.g., January, Feb, etc.)",
      "year": number,
      "openingBalance": number,
      "closingBalance": number,
      "totalCredits": number,
      "totalDebits": number,
      "salaryCredit": number (if identifiable as salary),
      "emiPayments": number (sum of EMI-like payments),
      "minBalance": number,
      "bounces": number
    }
  ],
  "averageMonthlyBalance": number,
  "totalEmiObserved": number,
  "salaryConsistency": "consistent|irregular|not_found",
  "summary": {
    "totalTransactions": number,
    "avgMonthlyCredits": number,
    "avgMonthlyDebits": number,
    "balanceStability": "high|medium|low"
  }
}

ANALYSIS INSTRUCTIONS:
1. Look for account holder name and account number
2. Identify the bank name
3. Extract statement period (from/to dates)
4. Analyze transaction patterns month by month
5. Calculate average monthly balance
6. Identify salary credits (look for regular, similar amounts around month start/end)
7. Calculate EMI payments (look for regular fixed payments)
8. Count any bounced transactions
9. If account type is not clear, default to "savings"`;

    try {
      const client = agentPool.getGemini();

      // If we have text chunks instead of images, send them as text
      const hasTextChunks = images.some((img) => img.type === "text_chunk");
      const hasImages = images.some((img) => img.type === "image_url");

      let content = [{ type: "text", text: prompt }];

      if (hasImages) {
        // Add image items
        const imageItems = images.filter((img) => img.type === "image_url");
        imageItems.forEach((img) => {
          content.push({
            type: "image_url",
            image_url: img.image_url,
          });
        });
      }

      if (hasTextChunks) {
        // Add text items
        const textItems = images.filter((img) => img.type === "text_chunk");
        textItems.forEach((txt) => {
          content.push({
            type: "text",
            text: `Page ${txt.page || "unknown"}: ${txt.text}`,
          });
        });
      }

      const message = new HumanMessage({ content });

      const response = await this.invokeWithRateLimit(
        client,
        message,
        "BankStatementAgent"
      );
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (result && typeof result === "object") {
        // Ensure accountType is valid
        if (
          result.accountType &&
          !["savings", "current", "salary"].includes(result.accountType)
        ) {
          result.accountType = "savings";
        }

        console.log(
          `✅ Bank statement analyzed: ${
            result.monthlyData?.length || 0
          } months of data`
        );
        return result;
      } else {
        console.warn(
          "⚠️ Could not parse bank statement, returning basic structure"
        );
        return this.getFallbackBankData();
      }
    } catch (error) {
      console.error("❌ Bank statement extraction failed:", error.message);
      return this.getFallbackBankData();
    }
  }

  static getFallbackBankData() {
    return {
      accountNumber: null,
      bankName: null,
      ifscCode: null,
      accountType: "savings", // Changed from "unknown" to "savings"
      statementPeriod: { from: null, to: null },
      monthlyData: [],
      averageMonthlyBalance: 0,
      totalEmiObserved: 0,
      salaryConsistency: "not_found",
      summary: {
        totalTransactions: 0,
        avgMonthlyCredits: 0,
        avgMonthlyDebits: 0,
        balanceStability: "low",
      },
    };
  }
}
class ITRAgent extends BaseAgent {
  static async extract(images) {
    if (images.length === 0) return [];

    console.log(`📋 Processing ${images.length} ITR document items...`);

    const prompt = `Extract ALL Income Tax Return (ITR) data from the provided documents. Return ONLY valid JSON array:

[
  {
    "assessmentYear": "string (e.g., 2023-24, 2024-25)",
    "financialYear": "string (e.g., 2022-23, 2023-24)",
    "totalIncome": number,
    "taxPaid": number,
    "filingDate": "DD/MM/YYYY or null",
    "incomeFromSalary": number,
    "incomeFromBusiness": number,
    "incomeFromOtherSources": number,
    "acknowledged": boolean,
    "acknowledgmentNumber": "string or null",
    "panNumber": "string or null",
    "documentType": "itr"
  }
]

EXTRACTION RULES:
1. Extract data from ALL ITR documents present
2. Look for assessment year and financial year
3. Find total income declared
4. Extract tax paid amount
5. Look for filing date
6. Try to find PAN number
7. Check if acknowledged and get acknowledgment number
8. For missing fields, use 0 for numbers, null for strings, false for boolean`;

    try {
      const client = agentPool.getGemini();

      const message = new HumanMessage({
        content: [{ type: "text", text: prompt }, ...images],
      });

      const response = await this.invokeWithRateLimit(
        client,
        message,
        "ITRAgent"
      );
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (Array.isArray(result)) {
        console.log(`✅ Extracted ${result.length} ITR records`);
        return result;
      } else if (result && typeof result === "object") {
        console.log(`✅ Extracted 1 ITR record (wrapped in array)`);
        return [result];
      } else {
        console.warn("⚠️ Could not parse ITR data, returning empty array");
        return [];
      }
    } catch (error) {
      console.error("❌ ITR extraction failed:", error.message);
      return [];
    }
  }
}

class Form16Agent extends BaseAgent {
  static async extract(images) {
    if (images.length === 0) return [];

    console.log(`📄 Processing ${images.length} Form 16 items...`);

    const prompt = `Extract Form 16 data. Return ONLY valid JSON array:

[
  {
    "financialYear": "string (e.g., 2022-23, 2023-24)",
    "employerName": "string or null",
    "grossSalary": number,
    "standardDeduction": number,
    "taxableIncome": number,
    "tdsDeducted": number,
    "panNumber": "string or null",
    "employeeName": "string or null",
    "documentType": "form_16"
  }
]

EXTRACTION GUIDELINES:
1. Extract ALL Form 16 documents found
2. Look for financial year prominently displayed
3. Find employer name
4. Extract gross salary and taxable income
5. Get TDS deducted amount
6. Look for PAN numbers (both employer and employee)
7. For missing values, use 0 for numbers and null for strings`;

    try {
      const client = agentPool.getGemini();

      const message = new HumanMessage({
        content: [{ type: "text", text: prompt }, ...images],
      });

      const response = await this.invokeWithRateLimit(
        client,
        message,
        "Form16Agent"
      );
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (Array.isArray(result)) {
        console.log(`✅ Extracted ${result.length} Form 16 records`);
        return result;
      } else if (result && typeof result === "object") {
        console.log(`✅ Extracted 1 Form 16 record (wrapped in array)`);
        return [result];
      } else {
        console.warn("⚠️ Could not parse Form 16 data, returning empty array");
        return [];
      }
    } catch (error) {
      console.error("❌ Form 16 extraction failed:", error.message);
      return [];
    }
  }
}

class BusinessProofAgent extends BaseAgent {
  static async extract(images) {
    if (images.length === 0) return null;

    console.log(`🏢 Processing ${images.length} business proof items...`);

    const prompt = `Extract business/professional proof data. Return ONLY valid JSON:

{
  "businessName": "string or null",
  "gstNumber": "string or null",
  "registrationNumber": "string or null",
  "annualRevenue": number,
  "annualProfit": number,
  "businessType": "string (e.g., Proprietorship, Partnership, LLP, Pvt Ltd)",
  "ownerName": "string or null",
  "documentType": "business_proof",
  "financialYear": "string or null",
  "verified": boolean
}

LOOK FOR:
1. Business/company name
2. GST number (format: 00AAAAA0000A0Z0)
3. Registration number (CIN, LLPIN, etc.)
4. Financial figures (revenue, profit, turnover)
5. Type of business entity
6. Owner/director names
7. Financial year
8. Any verification/registration details`;

    try {
      const client = agentPool.getGemini();

      const message = new HumanMessage({
        content: [{ type: "text", text: prompt }, ...images],
      });

      const response = await this.invokeWithRateLimit(
        client,
        message,
        "BusinessProofAgent"
      );
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (result && typeof result === "object") {
        console.log(`✅ Business proof extracted`);
        return result;
      } else {
        console.warn(
          "⚠️ Could not parse business proof, returning basic structure"
        );
        return {
          businessName: null,
          gstNumber: null,
          registrationNumber: null,
          annualRevenue: 0,
          annualProfit: 0,
          businessType: null,
          ownerName: null,
          documentType: "business_proof",
          financialYear: null,
          verified: false,
        };
      }
    } catch (error) {
      console.error("❌ Business proof extraction failed:", error.message);
      return {
        businessName: null,
        gstNumber: null,
        registrationNumber: null,
        annualRevenue: 0,
        annualProfit: 0,
        businessType: null,
        ownerName: null,
        documentType: "business_proof",
        financialYear: null,
        verified: false,
      };
    }
  }
}

// ============================================================================
// VERIFICATION AGENT
// ============================================================================

class FinancialVerificationAgent extends BaseAgent {
  static async verify(financialData) {
    console.log("🔍 Verifying financial data...");

    const prompt = `Analyze this co-borrower's financial data and verify eligibility for loan application. Return ONLY valid JSON:

{
  "valid": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": "string explaining verification result",
  "issues": ["array of critical issues that make applicant ineligible"],
  "warnings": ["array of warnings that need attention"],
  "financialMetrics": {
    "incomeStability": "stable|irregular|insufficient_data",
    "emiAffordability": "good|moderate|high_risk",
    "bankBehavior": "good|average|poor",
    "documentConsistency": "consistent|minor_gaps|major_gaps",
    "debtToIncome": "low|medium|high",
    "savingsPattern": "good|average|poor"
  },
  "recommendation": "approve|review|reject",
  "riskScore": number (1-10, where 1 is lowest risk)
}

VERIFICATION CRITERIA:
1. Minimum Income: Avg monthly income > ₹25,000
2. FOIR (Fixed Obligation to Income Ratio): <40% good, 40-50% moderate, >50% high risk, >60% reject
3. Bank Balance: Minimum balance > ₹5,000 consistently
4. Salary Consistency: At least 3 months of regular salary
5. Document Completeness: Should have salary slips + bank statement OR ITR
6. No Bounces: Check for bounced transactions in bank statement
7. Income Stability: Regular income pattern

DATA TO ANALYZE:
${JSON.stringify(financialData, null, 2)}

ANALYSIS NOTES:
- Be realistic in assessment
- Consider partial data scenarios
- Highlight missing information
- Calculate metrics based on available data
- Provide actionable feedback`;

    try {
      const client = agentPool.getGroq();
      const message = new HumanMessage({ content: prompt });

      const response = await client.invoke([message]);
      const text = this.extractText(response);
      const result = this.safeJsonParse(text);

      if (!result || typeof result.valid !== "boolean") {
        throw new Error("Invalid verification response format");
      }

      console.log(
        `✅ Verification result: ${result.valid ? "VALID" : "INVALID"} (${
          result.confidence
        })`
      );
      return {
        valid: Boolean(result.valid),
        confidence: result.confidence || "medium",
        reason: String(result.reason || "Verification completed"),
        issues: Array.isArray(result.issues) ? result.issues : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        financialMetrics: result.financialMetrics || {},
        recommendation: result.recommendation || "review",
        riskScore: typeof result.riskScore === "number" ? result.riskScore : 5,
      };
    } catch (error) {
      console.error("❌ Verification error:", error.message);
      return this.fallbackVerification(financialData);
    }
  }

  static fallbackVerification(financialData) {
    console.log("⚠️ Using fallback verification...");

    const issues = [];
    const warnings = [];
    let valid = true;

    // Basic income check
    const avgIncome = financialData.financialSummary?.avgMonthlyIncome || 0;
    if (avgIncome === 0) {
      issues.push("No income data found");
      valid = false;
    } else if (avgIncome < 25000) {
      issues.push(
        `Average monthly income (₹${avgIncome}) below ₹25,000 threshold`
      );
      valid = false;
    }

    // FOIR check
    const foir = financialData.financialSummary?.foir || 0;
    if (foir > 60) {
      issues.push(`FOIR ${foir}% exceeds 60% limit`);
      valid = false;
    } else if (foir > 50) {
      warnings.push(`FOIR ${foir}% is high risk (50-60%)`);
    } else if (foir > 40) {
      warnings.push(`FOIR ${foir}% is moderate (40-50%)`);
    }

    // Document completeness
    const salarySlipCount = financialData.salarySlips?.length || 0;
    const bankMonths = financialData.bankStatement?.monthlyData?.length || 0;
    const itrCount = financialData.itrData?.length || 0;

    if (salarySlipCount === 0 && itrCount === 0) {
      issues.push("No income proof documents found");
      valid = false;
    } else if (salarySlipCount < 3 && salarySlipCount > 0) {
      warnings.push(`Only ${salarySlipCount} salary slips (recommended: 3+)`);
    }

    if (bankMonths === 0) {
      warnings.push("No bank statement data available");
    } else if (bankMonths < 3) {
      warnings.push(`Limited bank statement data (${bankMonths} months)`);
    }

    // Calculate confidence
    let confidence = "medium";
    if (issues.length === 0 && warnings.length === 0) {
      confidence = "high";
    } else if (issues.length > 0) {
      confidence = "low";
    }

    return {
      valid,
      confidence,
      reason:
        issues.length === 0
          ? "Basic validation passed"
          : "Validation issues found",
      issues,
      warnings,
      financialMetrics: {
        incomeStability: salarySlipCount >= 3 ? "stable" : "irregular",
        emiAffordability:
          foir > 50 ? "high_risk" : foir > 40 ? "moderate" : "good",
        bankBehavior: bankMonths > 0 ? "average" : "insufficient_data",
        documentConsistency:
          salarySlipCount >= 3 && bankMonths >= 3 ? "consistent" : "minor_gaps",
        debtToIncome: foir > 50 ? "high" : foir > 30 ? "medium" : "low",
        savingsPattern: "insufficient_data",
      },
      recommendation: valid ? "approve" : "reject",
      riskScore: issues.length > 0 ? 8 : warnings.length > 0 ? 5 : 2,
    };
  }
}

// ============================================================================
// ORCHESTRATOR WITH SEQUENTIAL PROCESSING
// ============================================================================

class CoBorrowerWorkflowOrchestrator {
  static async processDocuments(filePaths, options = {}) {
    const startTime = Date.now();
    const { maxRetries = 2, timeoutMs = 300000 } = options;

    try {
      await agentPool.initialize();

      const { categorized, totalPages } =
        await DocumentProcessor.categorizeAndPrepareFiles(filePaths);

      if (totalPages === 0) {
        throw new Error("No valid financial documents provided");
      }

      console.log(`📊 Processing ${totalPages} total items:`);
      console.log(`  - Salary slips: ${categorized.salarySlips.length} items`);
      console.log(
        `  - Bank statements: ${categorized.bankStatements.length} items`
      );
      console.log(`  - ITR docs: ${categorized.itrs.length} items`);
      console.log(`  - Form 16: ${categorized.form16s.length} items`);
      console.log(`  - Business: ${categorized.business.length} items`);

      // SEQUENTIAL PROCESSING with rate limit protection
      console.log("🤖 Starting sequential extraction (rate limit safe)...");

      const financialData = {
        personalInfo: {},
        salarySlips: [],
        bankStatement: {
          monthlyData: [],
          averageMonthlyBalance: 0,
          totalEmiObserved: 0,
          salaryConsistency: "not_found",
        },
        itrData: [],
        form16Data: [],
        businessProof: {},
        financialSummary: {
          avgMonthlySalary: 0,
          avgMonthlyIncome: 0,
          totalExistingEmi: 0,
          estimatedAnnualIncome: 0,
          foir: 0,
          incomeSource: "salaried",
          incomeStability: "insufficient_data",
          documentCompleteness: {
            salarySlipCount: 0,
            bankStatementMonths: 0,
            itrYears: 0,
            form16Years: 0,
            hasBusinessProof: false,
          },
        },
      };

      // Extract sequentially to avoid rate limits
      if (categorized.salarySlips.length > 0) {
        financialData.salarySlips = await this.retryOperation(
          () => SalarySlipAgent.extract(categorized.salarySlips),
          maxRetries,
          "SalarySlipAgent"
        );
      }

      if (categorized.bankStatements.length > 0) {
        const bankData = await this.retryOperation(
          () => BankStatementAgent.extract(categorized.bankStatements),
          maxRetries,
          "BankStatementAgent"
        );
        if (bankData) {
          financialData.bankStatement = bankData;
        }
      }

      if (categorized.itrs.length > 0) {
        financialData.itrData = await this.retryOperation(
          () => ITRAgent.extract(categorized.itrs),
          maxRetries,
          "ITRAgent"
        );
      }

      if (categorized.form16s.length > 0) {
        financialData.form16Data = await this.retryOperation(
          () => Form16Agent.extract(categorized.form16s),
          maxRetries,
          "Form16Agent"
        );
      }

      if (categorized.business.length > 0) {
        const businessData = await this.retryOperation(
          () => BusinessProofAgent.extract(categorized.business),
          maxRetries,
          "BusinessProofAgent"
        );
        if (businessData) {
          financialData.businessProof = businessData;
        }
      }

      this.calculateFinancialMetrics(financialData);

      console.log("🔍 Starting verification...");
      const verification = await this.retryOperation(
        () => FinancialVerificationAgent.verify(financialData),
        maxRetries,
        "VerificationAgent"
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Workflow completed in ${duration}ms`);
      console.log(
        `  - Salary slips extracted: ${financialData.salarySlips.length}`
      );
      console.log(
        `  - Bank months analyzed: ${financialData.bankStatement.monthlyData.length}`
      );
      console.log(`  - ITR years extracted: ${financialData.itrData.length}`);
      console.log(
        `  - Form 16 years extracted: ${financialData.form16Data.length}`
      );
      console.log(
        `  - Avg monthly income: ₹${financialData.financialSummary.avgMonthlyIncome}`
      );
      console.log(`  - FOIR: ${financialData.financialSummary.foir}%`);
      console.log(
        `  - Verification: ${verification.valid ? "VALID" : "INVALID"} (${
          verification.confidence
        })`
      );

      return {
        financialData,
        verification,
        metadata: {
          processingTime: duration,
          totalPages,
          agentsUsed: 5,
          extractedCounts: {
            salarySlips: financialData.salarySlips.length,
            bankMonths: financialData.bankStatement.monthlyData.length,
            itrYears: financialData.itrData.length,
            form16Years: financialData.form16Data.length,
            hasBusinessProof: !!Object.keys(financialData.businessProof).length,
          },
        },
      };
    } catch (error) {
      console.error("❌ Workflow failed:", error.message);
      console.error("Stack:", error.stack);

      // Return partial results if available
      return {
        financialData: {},
        verification: {
          valid: false,
          confidence: "low",
          reason: `Processing failed: ${error.message}`,
          issues: ["Document processing failed"],
          warnings: ["System error occurred"],
          financialMetrics: {},
          recommendation: "reject",
          riskScore: 10,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          totalPages: 0,
          agentsUsed: 0,
          error: error.message,
        },
      };
    }
  }

  static calculateFinancialMetrics(financialData) {
    // Calculate from salary slips
    if (financialData.salarySlips.length > 0) {
      const validSalaries = financialData.salarySlips
        .filter((slip) => slip.netSalary || slip.grossSalary)
        .map((slip) => slip.netSalary || slip.grossSalary || 0);

      if (validSalaries.length > 0) {
        const totalSalary = validSalaries.reduce(
          (sum, salary) => sum + salary,
          0
        );
        financialData.financialSummary.avgMonthlySalary = Math.round(
          totalSalary / validSalaries.length
        );
        financialData.financialSummary.avgMonthlyIncome =
          financialData.financialSummary.avgMonthlySalary;
      }
    }

    // Calculate from ITR if no salary slips
    if (
      financialData.financialSummary.avgMonthlyIncome === 0 &&
      financialData.itrData.length > 0
    ) {
      const totalITRIncome = financialData.itrData.reduce(
        (sum, itr) => sum + (itr.totalIncome || 0),
        0
      );
      if (totalITRIncome > 0) {
        financialData.financialSummary.avgMonthlyIncome = Math.round(
          totalITRIncome / financialData.itrData.length / 12
        );
      }
    }

    // Calculate from business proof
    if (
      financialData.financialSummary.avgMonthlyIncome === 0 &&
      financialData.businessProof.annualRevenue
    ) {
      financialData.financialSummary.avgMonthlyIncome = Math.round(
        financialData.businessProof.annualRevenue / 12
      );
    }

    // Calculate existing EMI
    financialData.financialSummary.totalExistingEmi =
      financialData.bankStatement?.totalEmiObserved || 0;

    // Calculate FOIR
    const avgIncome = financialData.financialSummary.avgMonthlyIncome || 0;
    const totalEmi = financialData.financialSummary.totalExistingEmi || 0;

    if (avgIncome > 0) {
      financialData.financialSummary.foir = parseFloat(
        ((totalEmi / avgIncome) * 100).toFixed(2)
      );
      financialData.financialSummary.estimatedAnnualIncome = Math.round(
        avgIncome * 12
      );
    }

    // Determine income source
    if (financialData.salarySlips.length > 0) {
      financialData.financialSummary.incomeSource = "salaried";
      financialData.financialSummary.incomeStability =
        financialData.salarySlips.length >= 3 ? "stable" : "irregular";
    } else if (financialData.businessProof?.annualRevenue) {
      financialData.financialSummary.incomeSource = "business";
      financialData.financialSummary.incomeStability = "stable";
    } else if (financialData.itrData.length > 0) {
      financialData.financialSummary.incomeSource = "self_employed";
      financialData.financialSummary.incomeStability =
        financialData.itrData.length >= 2 ? "stable" : "irregular";
    }

    // Document completeness
    financialData.financialSummary.documentCompleteness = {
      salarySlipCount: financialData.salarySlips.length,
      bankStatementMonths:
        financialData.bankStatement?.monthlyData?.length || 0,
      itrYears: financialData.itrData.length,
      form16Years: financialData.form16Data.length,
      hasBusinessProof: !!(
        financialData.businessProof &&
        Object.keys(financialData.businessProof).length > 0
      ),
    };
  }

  static async retryOperation(operation, maxRetries, agentName) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(
          `❌ ${agentName} attempt ${attempt + 1} failed:`,
          error.message
        );

        // Handle rate limit errors specially
        const wasRateLimitHandled = await BaseAgent.handleRateLimitError(
          error,
          attempt
        );

        if (attempt < maxRetries) {
          if (!wasRateLimitHandled) {
            // Regular exponential backoff
            const delay = Math.pow(2, attempt) * 2000;
            console.warn(`⚠️ Retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    console.error(`❌ ${agentName} failed after ${maxRetries} retries`);
    throw lastError;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

async function processCoBorrowerDocuments(filePaths, options = {}) {
  return await CoBorrowerWorkflowOrchestrator.processDocuments(
    filePaths,
    options
  );
}

module.exports = {
  processCoBorrowerDocuments,
  agentPool,
  DocumentProcessor,
  SalarySlipAgent,
  BankStatementAgent,
  ITRAgent,
  Form16Agent,
  BusinessProofAgent,
  FinancialVerificationAgent,
};
