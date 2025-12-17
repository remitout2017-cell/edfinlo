// agents/coborrower/HybridITRAgent.js
const config = require("../../config/config");

class HybridITRAgent {
  constructor() {
    this.useGemini = !!config.ai.gemeniApiKey;
    this.useOpenRouter = !!config.ai.openRouterApiKey;

    if (this.useGemini) {
      const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
      this.geminiClient = new ChatGoogleGenerativeAI({
        apiKey: config.ai.gemeniApiKey,
        model: "gemini-2.5-flash",
        temperature: 0.05,
        maxOutputTokens: 8192,
        timeout: 120000,
      });
      console.log("🤖 Hybrid ITR Agent: Gemini enabled");
    }

    if (this.useOpenRouter) {
      const BaseAgent = require("./BaseAgent");
      this.openRouterAgent = new BaseAgent("nvidia/nemotron-nano-12b-v2-vl:free");
      console.log("🤖 Hybrid ITR Agent: OpenRouter enabled");
    }
  }

  async extractITRDetails(imagesByYear) {
    const results = [];

    for (const [year, images] of Object.entries(imagesByYear)) {
      console.log(`📋 Processing ITR ${year} with ${images.length} images`);

      let data;

      // Try Gemini first (more reliable for ITR)
      if (this.useGemini) {
        try {
          data = await this.extractWithGemini(images, year);
          data.source = "gemini";
        } catch (error) {
          console.log(`❌ Gemini failed for ITR ${year}:`, error.message);
          data = null;
        }
      }

      // If Gemini failed, try OpenRouter
      if (!data && this.useOpenRouter) {
        try {
          data = await this.extractWithOpenRouter(images, year);
          data.source = "openrouter";
        } catch (error) {
          console.log(`❌ OpenRouter failed for ITR ${year}:`, error.message);
        }
      }

      // If both failed, use fallback
      if (!data) {
        data = this.getFallbackData(year);
        data.source = "fallback";
      }

      data.year = year;
      results.push(data);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  async extractWithGemini(images, year) {
    const prompt = `Extract ITR details from Indian Income Tax Return. Return ONLY JSON:

{
  "assessmentYear": "string (e.g., 2021-22)",
  "financialYear": "string (e.g., 2020-21)",
  "panNumber": "string (10 chars like ABCDE1234F)",
  "name": "string",
  "incomeFromSalary": number,
  "grossTotalIncome": number,
  "taxableIncome": number,
  "taxPaid": number,
  "acknowledgmentNumber": "string",
  "filingDate": "DD/MM/YYYY",
  "confidence": 0.9
}

Extract from all available pages.`;

    const content = [
      { type: "text", text: prompt },
      ...images.slice(0, 3).map((img) => ({
        type: "image_url",
        image_url: img,
      })),
    ];

    const messages = [{ role: "user", content }];
    const response = await this.geminiClient.invoke(messages);

    return this.parseGeminiResponse(response, year);
  }

  async extractWithOpenRouter(images, year) {
    const prompt = `Extract PAN, name, income from ITR. Return ONLY JSON:
{
  "panNumber": "PAN or null",
  "name": "name or null",
  "taxableIncome": number
}`;

    const content = [
      { type: "text", text: prompt },
      ...this.openRouterAgent.createImageContent([images[0]], 1),
    ];

    const messages = [{ role: "user", content }];
    const response = await this.openRouterAgent.invokeWithRetry(messages);

    const data = this.openRouterAgent.parseResponse(response);

    const y = parseInt(year, 10);
    return {
      assessmentYear: `${y}-${y + 1}`,
      financialYear: `${y - 1}-${y}`,
      panNumber: data.panNumber || null,
      name: data.name || null,
      taxableIncome: data.taxableIncome || 0,
      confidence: 0.7,
      source: "openrouter",
    };
  }

  parseGeminiResponse(response, year) {
    try {
      let raw =
        typeof response?.content === "string"
          ? response.content
          : response?.text || "";

      const text = raw.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No JSON found");
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      throw error;
    }
  }

  getFallbackData(year) {
    const y = parseInt(year, 10) || new Date().getFullYear();
    return {
      assessmentYear: `${y}-${y + 1}`,
      financialYear: `${y - 1}-${y}`,
      panNumber: null,
      name: null,
      incomeFromSalary: 0,
      grossTotalIncome: 0,
      taxableIncome: 0,
      taxPaid: 0,
      confidence: 0.1,
      isVerified: false,
    };
  }
}

module.exports = new HybridITRAgent();
