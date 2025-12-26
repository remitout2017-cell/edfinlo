// chatbot/routes/chatbot.routes.js

const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getGreeting,
  getChatHistory,
  getUserSessions,
  clearSession,
  getCacheStats,
} = require("../controllers/chatbot.controller");

// Change this line - use default import instead of named import
const authMiddleware = require("../../middleware/authMiddleware");
const { apiLimiter } = require("../../middleware/rateLimit");

// All routes require authentication
router.use(authMiddleware); // Changed from protect to authMiddleware

// Chatbot routes
router.post("/message", apiLimiter, sendMessage);
router.get("/greeting", getGreeting);
router.get("/history/:sessionId", getChatHistory);
router.get("/sessions", getUserSessions);
router.delete("/session/:sessionId", clearSession);

// Admin only
router.get("/stats", getCacheStats);

module.exports = router;
