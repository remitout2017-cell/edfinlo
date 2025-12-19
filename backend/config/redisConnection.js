// utils/redisConnection.js
const IORedis = require("ioredis");
const config = require("../config/config");

const redisConnection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected for BullMQ");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

module.exports = { redisConnection };
