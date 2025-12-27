// chatbot/config/embeddings.js - VERIFY THIS
const { pipeline, env } = require("@xenova/transformers");
const NodeCache = require("node-cache");

env.cacheDir = "./.cache";

const embeddingCache = new NodeCache({
  stdTTL: 3600,
  maxKeys: 10000,
});

class FreeLocalEmbeddings {
  constructor() {
    this.extractor = null;
    this.initialized = false;
    this.modelName = "Xenova/all-MiniLM-L6-v2";
  }

  async initialize() {
    if (this.initialized) return;
    console.log("🔄 Loading embedding model...");
    try {
      this.extractor = await pipeline("feature-extraction", this.modelName, {
        quantized: true,
      });
      await this.extractor("test", { pooling: "mean", normalize: true });
      this.initialized = true;
      console.log("✅ Embedding model loaded");
    } catch (error) {
      console.error("❌ Failed to load embedding model:", error);
      throw error;
    }
  }

  async embedDocuments(texts) {
    if (!this.initialized) await this.initialize();
    const results = [];
    const uncachedTexts = [];
    const uncachedIndices = [];

    texts.forEach((text, idx) => {
      const cacheKey = `doc:${this.hashString(text)}`;
      const cached = embeddingCache.get(cacheKey);
      if (cached) {
        results[idx] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(idx);
      }
    });

    if (uncachedTexts.length > 0) {
      console.log(`🔢 Generating ${uncachedTexts.length} new embeddings...`);
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i];
        const output = await this.extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        const embedding = Array.from(output.data);
        const originalIdx = uncachedIndices[i];
        results[originalIdx] = embedding;
        const cacheKey = `doc:${this.hashString(text)}`;
        embeddingCache.set(cacheKey, embedding);
      }
    }
    return results;
  }

  async embedQuery(text) {
    if (!this.initialized) await this.initialize();
    const cacheKey = `query:${this.hashString(text)}`;
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      console.log("💾 Cache HIT");
      return cached;
    }

    const output = await this.extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    const embedding = Array.from(output.data);
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  getCacheStats() {
    return embeddingCache.getStats();
  }
}

// ✅ SINGLE EXPORT - NO DUPLICATES
module.exports = new FreeLocalEmbeddings();
