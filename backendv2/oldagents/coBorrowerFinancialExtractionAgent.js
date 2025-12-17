// agents/coBorrowerFinancialExtractionAgent.js - OPTIMIZED VERSION

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const { fromPath } = require("pdf2pic");
const config = require("../config/config");

let gemini = null;

async function getGeminiClient() {
  if (gemini) return gemini;

  if (!config.ai.gemeniApiKey) {
    throw new Error("GEMENI_API_KEY missing");
  }

  gemini = new ChatGoogleGenerativeAI({
    apiKey: config.ai.gemeniApiKey,
    model: "gemini-2.5-flash",
    temperature: 0,
    maxOutputTokens: 8192,
    timeout: 180000, // 3 minutes for large documents
  });

  console.log("✅ Gemini client initialized for financial extraction");
  return gemini;
}

// ✅ OPTIMIZED: Convert PDF with adaptive quality based on page count
async function convertPdfToOptimizedImages(pdfPath, maxPages = 50) {
  const pageCount = await getPdfPageCount(pdfPath);

  // Adaptive quality: more pages = lower quality to stay within limits
  const density = pageCount > 20 ? 60 : pageCount > 10 ? 70 : 80;
  const width = pageCount > 20 ? 1200 : pageCount > 10 ? 1400 : 1600;
  const quality = pageCount > 20 ? 70 : pageCount > 10 ? 75 : 80;

  console.log(
    `📄 Processing ${pageCount} pages with density=${density}, width=${width}px`
  );

  const options = {
    density,
    format: "jpeg",
    width,
    height: width,
    quality,
  };

  const storeAsImage = fromPath(pdfPath, options);
  const buffers = [];
  const pagesToProcess = Math.min(pageCount, maxPages);

  // ✅ Process in batches to avoid memory issues
  const batchSize = 5;
  for (let i = 0; i < pagesToProcess; i += batchSize) {
    const batchPromises = [];

    for (
      let page = i + 1;
      page <= Math.min(i + batchSize, pagesToProcess);
      page++
    ) {
      batchPromises.push(
        (async () => {
          try {
            const imagePath = await storeAsImage(page, {
              saveFilename: `page-${page}-${Date.now()}`,
            });

            const optimizedBuffer = await sharp(imagePath.path)
              .jpeg({ quality })
              .toBuffer();

            await fs.unlink(imagePath.path);

            return {
              type: "image_url",
              image_url: `data:image/jpeg;base64,${optimizedBuffer.toString(
                "base64"
              )}`,
              page,
            };
          } catch (err) {
            console.warn(`⚠️ Failed to process page ${page}:`, err.message);
            return null;
          }
        })()
      );
    }

    const batchResults = await Promise.all(batchPromises);
    buffers.push(...batchResults.filter(Boolean));

    console.log(
      `✅ Processed pages ${i + 1}-${Math.min(i + batchSize, pagesToProcess)}`
    );
  }

  return buffers;
}

// Helper to get PDF page count
async function getPdfPageCount(pdfPath) {
  try {
    const pdfParse = require("pdf-parse");
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.numpages;
  } catch (error) {
    console.warn("⚠️ Could not determine PDF page count, assuming 10");
    return 10;
  }
}

// ✅ OPTIMIZED: Categorize and prepare files
async function prepareFilesForExtraction(filePaths) {
  console.log(
    `📸 Preparing ${Object.keys(filePaths).length} files for extraction...`
  );

  const categorizedBuffers = {
    salarySlips: [],
    bankStatements: [],
    itrs: [],
    form16s: [],
    business: [],
  };

  let totalPages = 0;

  for (const [key, filePath] of Object.entries(filePaths)) {
    if (!filePath) continue;

    const ext = path.extname(filePath).toLowerCase();
    const keyLower = key.toLowerCase();

    try {
      let buffers = [];

      if (ext === ".pdf") {
        buffers = await convertPdfToOptimizedImages(filePath);
        totalPages += buffers.length;
      } else if ([".jpeg", ".jpg", ".png"].includes(ext)) {
        const buffer = await sharp(filePath)
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        buffers = [
          {
            type: "image_url",
            image_url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          },
        ];
        totalPages += 1;
      }

      // ✅ Categorize by document type
      if (keyLower.includes("salary")) {
        categorizedBuffers.salarySlips.push(...buffers);
      } else if (keyLower.includes("bank") || keyLower.includes("stmt")) {
        categorizedBuffers.bankStatements.push(...buffers);
      } else if (keyLower.includes("itr")) {
        categorizedBuffers.itrs.push(...buffers);
      } else if (keyLower.includes("form16")) {
        categorizedBuffers.form16s.push(...buffers);
      } else if (keyLower.includes("business")) {
        categorizedBuffers.business.push(...buffers);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${key}:`, error.message);
    }
  }

  console.log(`✅ Total pages prepared: ${totalPages}`);
  return { categorizedBuffers, totalPages };
}

// Safe JSON parse
function safeJsonParse(text) {
  if (!text?.trim()) return null;

  let cleaned = text
    .trim()
    .replace(/```json\s*/gi, "")
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
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

// Extract text from response
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

/**
 * ✅ OPTIMIZED: Extract financial info from unlimited documents
 */
async function extractCoBorrowerFinancialInfo(filePaths, options = {}) {
  const startTime = Date.now();
  const { maxRetries = 1, timeoutMs = 180000 } = options;

  try {
    // Prepare files with categorization
    const { categorizedBuffers, totalPages } = await prepareFilesForExtraction(
      filePaths
    );

    if (totalPages === 0) {
      throw new Error("No valid financial documents provided");
    }

    console.log(`📊 Processing ${totalPages} total pages:`);
    console.log(
      `  - Salary slips: ${categorizedBuffers.salarySlips.length} pages`
    );
    console.log(
      `  - Bank statements: ${categorizedBuffers.bankStatements.length} pages`
    );
    console.log(`  - ITR docs: ${categorizedBuffers.itrs.length} pages`);
    console.log(`  - Form 16: ${categorizedBuffers.form16s.length} pages`);
    console.log(`  - Business: ${categorizedBuffers.business.length} pages`);

    // ✅ Combine all images for AI processing
    const allImages = [
      ...categorizedBuffers.salarySlips,
      ...categorizedBuffers.bankStatements,
      ...categorizedBuffers.itrs,
      ...categorizedBuffers.form16s,
      ...categorizedBuffers.business,
    ];

    // Enhanced prompt
    const prompt = `You are an expert financial document extraction AI. Extract comprehensive data from ALL provided documents.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON, no markdown, no explanation
2. Extract ALL documents found (salary slips, ITR, Form 16, bank statements)
3. NO FIXED LIMITS - extract as many years/months as found
4. If field not found, use null or 0
5. Initialize all arrays (use [] if empty)
6. Calculate averages accurately from ALL data

JSON Structure:
{
  "personalInfo": {
    "name": "string or null",
    "employeeId": "string or null",
    "companyName": "string or null",
    "designation": "string or null"
  },
  "salarySlips": [
    {
      "month": "string",
      "year": number,
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
      "employerName": "string or null"
    }
  ],
  "bankStatement": {
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
        "month": "string",
        "year": number,
        "openingBalance": number,
        "closingBalance": number,
        "totalCredits": number,
        "totalDebits": number,
        "salaryCredit": number,
        "emiPayments": number,
        "minBalance": number,
        "bounces": number
      }
    ],
    "averageMonthlyBalance": number,
    "totalEmiObserved": number,
    "salaryConsistency": "consistent|irregular|not_found"
  },
  "itrData": [
    {
      "assessmentYear": "string (e.g., 2023-24)",
      "financialYear": "string (e.g., 2022-23)",
      "totalIncome": number,
      "taxPaid": number,
      "filingDate": "DD/MM/YYYY or null",
      "incomeFromSalary": number,
      "incomeFromBusiness": number,
      "incomeFromOtherSources": number,
      "acknowledged": boolean,
      "acknowledgmentNumber": "string or null"
    }
  ],
  "form16Data": [
    {
      "financialYear": "string (e.g., 2022-23)",
      "employerName": "string or null",
      "grossSalary": number,
      "standardDeduction": number,
      "taxableIncome": number,
      "tdsDeducted": number,
      "panNumber": "string or null"
    }
  ],
  "businessProof": {
    "businessName": "string or null",
    "gstNumber": "string or null",
    "registrationNumber": "string or null",
    "annualRevenue": number,
    "annualProfit": number,
    "businessType": "string or null"
  },
  "financialSummary": {
    "avgMonthlySalary": number,
    "avgMonthlyIncome": number,
    "totalExistingEmi": number,
    "estimatedAnnualIncome": number,
    "foir": number,
    "incomeSource": "salaried|self_employed|business|mixed",
    "incomeStability": "stable|irregular|insufficient_data"
  }
}

EXTRACTION RULES:
- Extract ALL salary slips found (no limit)
- Extract ALL ITR documents found (any number of years)
- Extract ALL Form 16 found (any number of years)
- For bank statements: analyze ALL pages comprehensively
- Calculate avgMonthlySalary from ALL salary slips
- Calculate totalExistingEmi from bank statement EMI payments
- FOIR = (totalExistingEmi / avgMonthlyIncome) × 100
- Set incomeSource based on documents present
- Determine incomeStability based on consistency
- Initialize ALL arrays even if empty

Total pages to analyze: ${totalPages}

Extract now with maximum detail.`;

    const client = await getGeminiClient();
    const message = new HumanMessage({
      content: [{ type: "text", text: prompt }, ...allImages],
    });

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Extraction attempt ${attempt + 1}/${maxRetries + 1}...`
        );

        const response = await Promise.race([
          client.invoke([message]),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error(`Extraction timeout after ${timeoutMs}ms`)),
              timeoutMs
            )
          ),
        ]);

        const rawText = extractTextFromResponse(response);

        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Empty response from AI");
        }

        console.log(`📄 AI Response length: ${rawText.length} chars`);

        const result = safeJsonParse(rawText);
        if (!result) {
          console.error("❌ Failed to parse AI response");
          throw new Error("Invalid JSON from AI");
        }

        // ✅ NORMALIZE with flexible arrays
        const financialData = {
          personalInfo: result.personalInfo || {},
          salarySlips: Array.isArray(result.salarySlips)
            ? result.salarySlips
            : [],
          bankStatement: {
            ...(result.bankStatement || {}),
            monthlyData: Array.isArray(result.bankStatement?.monthlyData)
              ? result.bankStatement.monthlyData
              : [],
            averageMonthlyBalance:
              result.bankStatement?.averageMonthlyBalance || 0,
            totalEmiObserved: result.bankStatement?.totalEmiObserved || 0,
            salaryConsistency:
              result.bankStatement?.salaryConsistency || "not_found",
          },
          itrData: Array.isArray(result.itrData) ? result.itrData : [],
          form16Data: Array.isArray(result.form16Data) ? result.form16Data : [],
          businessProof: result.businessProof || {},
          financialSummary: {
            avgMonthlySalary: 0,
            avgMonthlyIncome: 0,
            totalExistingEmi: 0,
            estimatedAnnualIncome: 0,
            foir: 0,
            incomeSource: "salaried",
            incomeStability: "insufficient_data",
            ...(result.financialSummary || {}),
          },
        };

        // ✅ CALCULATE metrics from ALL available data
        if (financialData.salarySlips.length > 0) {
          const totalSalary = financialData.salarySlips.reduce((sum, slip) => {
            const salary = slip.netSalary || slip.grossSalary || 0;
            return sum + (typeof salary === "number" ? salary : 0);
          }, 0);

          financialData.financialSummary.avgMonthlySalary = Math.round(
            totalSalary / financialData.salarySlips.length
          );

          if (!financialData.financialSummary.avgMonthlyIncome) {
            financialData.financialSummary.avgMonthlyIncome =
              financialData.financialSummary.avgMonthlySalary;
          }
        }

        // FOIR calculation
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

        // Income source determination
        if (financialData.salarySlips.length > 0) {
          financialData.financialSummary.incomeSource = "salaried";
          financialData.financialSummary.incomeStability =
            financialData.salarySlips.length >= 3 ? "stable" : "irregular";
        } else if (financialData.businessProof?.annualRevenue) {
          financialData.financialSummary.incomeSource = "business";
        } else if (financialData.itrData.length > 0) {
          financialData.financialSummary.incomeSource = "self_employed";
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Extraction completed in ${duration}ms`);
        console.log(`  - Salary slips: ${financialData.salarySlips.length}`);
        console.log(
          `  - Bank months: ${financialData.bankStatement.monthlyData.length}`
        );
        console.log(`  - ITR years: ${financialData.itrData.length}`);
        console.log(`  - Form 16 years: ${financialData.form16Data.length}`);
        console.log(
          `  - Avg monthly income: ₹${financialData.financialSummary.avgMonthlyIncome}`
        );
        console.log(`  - FOIR: ${financialData.financialSummary.foir}%`);

        return financialData;
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️ Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  } catch (error) {
    console.error("❌ Financial extraction failed:", error.message);
    throw error;
  }
}

module.exports = {
  extractCoBorrowerFinancialInfo,
};
