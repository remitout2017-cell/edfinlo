// services/AICacheService.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const aiCacheSchema = new mongoose.Schema({
  hash: { type: String, unique: true, index: true },
  agentType: String, // 'kyc', 'salary', 'bank', 'itr', 'form16'
  modelUsed: String,
  inputHash: String,
  response: mongoose.Schema.Types.Mixed,
  confidence: Number,
  createdAt: { type: Date, default: Date.now, expires: 86400 * 7 }, // 7 days
});

const AICache = mongoose.model("AICache", aiCacheSchema);

class AICacheService {
  constructor() {
    this.ttl = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  generateHash(agentType, images) {
    const imageData = images
      .map((img) => img.substring(0, 100) + img.length)
      .join("|");

    return crypto
      .createHash("md5")
      .update(`${agentType}|${imageData}`)
      .digest("hex");
  }

  async get(agentType, images) {
    const hash = this.generateHash(agentType, images);
    const cached = await AICache.findOne({ hash });

    if (cached && Date.now() - cached.createdAt.getTime() < this.ttl) {
      console.log(`💾 Using cached AI result for ${agentType}`);
      return cached.response;
    }

    return null;
  }

  async set(agentType, images, response, modelUsed, confidence = 0.9) {
    const hash = this.generateHash(agentType, images);

    await AICache.findOneAndUpdate(
      { hash },
      {
        agentType,
        modelUsed,
        response,
        confidence,
        inputHash: hash.substring(0, 20),
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Cached AI result for ${agentType}`);
  }

  async clearOldEntries() {
    const cutoff = new Date(Date.now() - this.ttl);
    await AICache.deleteMany({ createdAt: { $lt: cutoff } });
  }
}

module.exports = new AICacheService();
