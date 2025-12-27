// chatbot/agents/responseCache.js - VERIFY THIS
const NodeCache = require("node-cache");
const { CACHE_SETTINGS } = require("../config/chatbotConfig");

class ResponseCache {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: CACHE_SETTINGS.ttl,
      checkperiod: 600,
      maxKeys: CACHE_SETTINGS.maxSize,
    });
    this.hits = 0;
    this.misses = 0;
  }

  getCacheKey(message, role, intent) {
    const normalized = message.toLowerCase().trim().replace(/\s+/g, " ");
    return `${role}:${intent}:${this.hashString(normalized)}`;
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

  get(message, role, intent) {
    if (!CACHE_SETTINGS.enabled) return null;
    const key = this.getCacheKey(message, role, intent);
    const cached = this.cache.get(key);
    if (cached) {
      this.hits++;
      console.log(`💾 Cache HIT (${this.getHitRate()}%)`);
      return cached;
    }
    this.misses++;
    return null;
  }

  set(message, role, intent, response) {
    if (!CACHE_SETTINGS.enabled) return;
    const key = this.getCacheKey(message, role, intent);
    this.cache.set(key, response);
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : ((this.hits / total) * 100).toFixed(1);
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      keys: this.cache.keys().length,
    };
  }

  clear() {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
  }
}

// ✅ SINGLE EXPORT - NO DUPLICATES
module.exports = new ResponseCache();
