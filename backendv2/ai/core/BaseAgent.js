// ai/agents/BaseAgent.js

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import axios from "axios";
import { HumanMessage } from "@langchain/core/messages";
import { AI_PROVIDERS, RETRY_CONFIG } from "../config/aiModels.js";
import { safeJSONParse } from "../utils/jsonParser.js";
import { optimizeImages } from "../utils/imageProcessor.js";
import { retryWithBackoff } from "../utils/retryHandler.js";

// Safety settings to prevent blocking legitimate document text
const GEMINI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

export class BaseAgent {
  constructor(modelConfig) {
    this.config = modelConfig;
    this.provider = modelConfig.provider;
    this.model = modelConfig.model;
    this.client = null;

    this.initializeClient();
  }

  initializeClient() {
    switch (this.provider) {
      case AI_PROVIDERS.GEMINI:
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) throw new Error("GEMINI_API_KEY not found");
        this.client = new ChatGoogleGenerativeAI({
          apiKey: geminiApiKey,
          model: this.config.model,
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          timeout: this.config.timeout,
          safetySettings: GEMINI_SAFETY_SETTINGS,
        });
        console.log(`✅ Initialized Gemini: ${this.config.model}`);
        break;

      case AI_PROVIDERS.GROQ:
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) throw new Error("GROQ_API_KEY not found");
        this.client = new ChatGroq({
          apiKey: groqApiKey,
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          timeout: this.config.timeout,
        });
        console.log(`✅ Initialized Groq: ${this.config.model}`);
        break;

      case AI_PROVIDERS.OPENROUTER:
        const openrouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY not found");
        this.client = axios.create({
          baseURL: "https://openrouter.ai/api/v1",
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "Loan Application Platform",
            "Content-Type": "application/json",
          },
          timeout: this.config.timeout,
        });
        console.log(`✅ Initialized OpenRouter: ${this.config.model}`);
        break;

      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Invoke with automatic retry and error handling
   */
  async invoke(prompt, images = [], options = {}) {
    return await retryWithBackoff(
      async () => await this._invokeInternal(prompt, images, options),
      {
        maxRetries: RETRY_CONFIG.MAX_RETRIES,
        baseDelay: RETRY_CONFIG.BASE_DELAY,
        maxDelay: RETRY_CONFIG.MAX_DELAY,
        rateLimitDelay: RETRY_CONFIG.RATE_LIMIT_DELAY,
        contextLabel: `${this.provider} (${this.model})`,
      }
    );
  }

  async _invokeInternal(prompt, images = [], options = {}) {
    const startTime = Date.now();
    try {
      let response;

      switch (this.provider) {
        case AI_PROVIDERS.GEMINI:
          response = await this.invokeGemini(prompt, images);
          break;
        case AI_PROVIDERS.GROQ:
          response = await this.invokeGroq(prompt);
          break;
        case AI_PROVIDERS.OPENROUTER:
          response = await this.invokeOpenRouter(prompt, images);
          break;
      }

      const duration = Date.now() - startTime;
      console.log(`✅ ${this.provider} responded in ${duration}ms`);

      return {
        content: response,
        provider: this.provider,
        model: this.config.model,
        duration,
      };
    } catch (error) {
      console.error(`❌ ${this.provider} invocation failed:`, error.message);
      throw error;
    }
  }

  async invokeGemini(prompt, images = []) {
    // 🔧 FIX: Use LangChain Standard Format (type: "text", type: "image_url")
    // Do NOT use raw Google format { text: ... } here
    const content = [{ type: "text", text: prompt }];

    // Add images if provided
    if (images && images.length > 0) {
      const optimizedImages = await optimizeImages(images, {
        maxSize: 4 * 1024 * 1024,
        maxWidth: 2048,
        maxHeight: 2048,
      });

      for (const img of optimizedImages) {
        content.push({
          type: "image_url",
          image_url: `data:${img.mimeType};base64,${img.base64}`,
        });
      }
    }

    const message = new HumanMessage({
      content: content,
    });

    const response = await this.client.invoke([message]);
    return this.extractTextFromResponse(response);
  }

  async invokeGroq(prompt) {
    const message = new HumanMessage({
      content: prompt,
    });
    const response = await this.client.invoke([message]);
    return this.extractTextFromResponse(response);
  }

  async invokeOpenRouter(prompt, images = []) {
    const content = [{ type: "text", text: prompt }];

    // Add images if supported
    if (images && images.length > 0 && this.config.supportsVision) {
      const optimizedImages = await optimizeImages(images, {
        maxSize: 5 * 1024 * 1024,
      });

      for (const img of optimizedImages) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
            detail: "auto",
          },
        });
      }
    }

    const response = await this.client.post("/chat/completions", {
      model: this.config.model,
      messages: [{ role: "user", content }],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return response.data.choices[0]?.message?.content || "";
  }

  extractTextFromResponse(response) {
    if (typeof response === "string") return response;

    // Handle LangChain Output
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
    }

    // Handle raw or other formats
    if (response?.lc_kwargs?.content) return response.lc_kwargs.content;
    if (response?.text) return response.text;

    return "";
  }

  parseJSON(rawResponse) {
    return safeJSONParse(rawResponse, null, `${this.provider}-${this.model}`);
  }
}
