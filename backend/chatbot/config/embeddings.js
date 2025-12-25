// chatbot/config/embeddings.js
const { pipeline, env } = require('@xenova/transformers');
const NodeCache = require('node-cache');

// Configure transformers to cache models locally
env.cacheDir = './.cache';

// Cache for embeddings
const embeddingCache = new NodeCache({ 
  stdTTL: 3600, 
  maxKeys: 10000 
});

class FreeLocalEmbeddings {
  constructor() {
    this.extractor = null;
    this.initialized = false;
    this.modelName = 'Xenova/all-MiniLM-L6-v2'; // Small, fast, accurate
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🔄 Loading embedding model (first time will download ~25MB)...');
    
    try {
      // Create feature extraction pipeline
      this.extractor = await pipeline(
        'feature-extraction',
        this.modelName,
        { quantized: true } // Use quantized model for better performance
      );

      // Warm up
      await this.extractor('test', { pooling: 'mean', normalize: true });
      
      this.initialized = true;
      console.log('✅ Embedding model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      throw error;
    }
  }

  async embedDocuments(texts) {
    if (!this.initialized) await this.initialize();

    const results = [];
    const uncachedTexts = [];
    const uncachedIndices = [];

    // Check cache
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

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      console.log(`🔢 Generating ${uncachedTexts.length} new embeddings...`);
      
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i];
        const output = await this.extractor(text, {
          pooling: 'mean',
          normalize: true,
        });

        // Convert to array
        const embedding = Array.from(output.data);
        
        // Store in results
        const originalIdx = uncachedIndices[i];
        results[originalIdx] = embedding;
        
        // Cache it
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
      console.log('💾 Cache HIT');
      return cached;
    }

    const output = await this.extractor(text, {
      pooling: 'mean',
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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  getCacheStats() {
    return embeddingCache.getStats();
  }
}

module.exports = new FreeLocalEmbeddings();
