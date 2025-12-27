// chatbot/controllers/chatbot.controller.js - FIXED
const asyncHandler = require("express-async-handler");
const chatbot = require("../agents/chatbotGraph");
const ChatHistory = require("../models/ChatHistory");
const { RATE_LIMITS } = require("../config/chatbotConfig");
const { v4: uuidv4 } = require("uuid");
const { getUserContext } = require("../utils/userDataFetcher");

const sendMessage = asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();

  if (!message || message.trim() === "") {
    res.status(400);
    throw new Error("Message is required");
  }

  const userRole = req.user.role || "student";
  const userId = req.user.id;
  let userModel = "User";
  if (userRole === "consultant") userModel = "Consultant";
  if (userRole === "nbfc") userModel = "NBFC";

  // Rate limiting
  const limits = RATE_LIMITS[userRole];
  const hourlyCount = await ChatHistory.getMessageCount(userId, 60 * 60 * 1000);

  if (hourlyCount >= limits.maxMessagesPerHour) {
    res.status(429);
    throw new Error(
      `Rate limit exceeded. Max ${limits.maxMessagesPerHour} messages/hour.`
    );
  }

  // Session management
  const currentSessionId = sessionId || uuidv4();
  let chatHistory = await ChatHistory.findOne({
    userId,
    sessionId: currentSessionId,
    isActive: true,
  });

  if (!chatHistory) {
    chatHistory = new ChatHistory({
      userId,
      userModel,
      userRole,
      sessionId: currentSessionId,
      messages: [],
    });
  }

  // Convert to LangChain message format
  const conversationHistory = chatHistory.messages.slice(-6).map((msg) => {
    const MessageClass =
      msg.role === "user"
        ? require("@langchain/core/messages").HumanMessage
        : require("@langchain/core/messages").AIMessage;
    return new MessageClass(msg.content);
  });

  // ✅ FIXED: Pass userId to chatbot
  const result = await chatbot.chat(
    message,
    userRole,
    userId, // ✅ Now passes userId
    conversationHistory
  );

  const responseTime = Date.now() - startTime;

  // Save to history
  chatHistory.messages.push({
    role: "user",
    content: message,
    timestamp: new Date(),
    intent: result.intent,
    metadata: { responseTime: 0 },
  });

  chatHistory.messages.push({
    role: "assistant",
    content: result.response,
    timestamp: new Date(),
    fromCache: result.fromCache || false,
    metadata: { responseTime },
  });

  chatHistory.messageCount = chatHistory.messages.length;
  chatHistory.lastMessageAt = new Date();
  await chatHistory.save();

  res.status(200).json({
    success: true,
    data: {
      response: result.response,
      sessionId: currentSessionId,
      intent: result.intent,
      fromCache: result.fromCache,
      responseTime,
    },
  });
});

const getGreeting = asyncHandler(async (req, res) => {
  const userRole = req.user.role || "student";
  const userId = req.user.id;

  let userName = null;
  if (userRole === "student") {
    const userContext = await getUserContext(userId);
    userName = userContext?.name;
  }

  const greeting = chatbot.getGreeting(userRole, userName);

  res.status(200).json({
    success: true,
    data: { greeting },
  });
});

// ... rest of the controller remains the same
const getChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const chatHistory = await ChatHistory.findOne({
    userId,
    sessionId,
    isActive: true,
  });

  if (!chatHistory) {
    res.status(404);
    throw new Error("Chat session not found");
  }

  res.status(200).json({
    success: true,
    data: chatHistory,
  });
});

const getUserSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const sessions = await ChatHistory.find({
    userId,
    isActive: true,
  })
    .sort({ lastMessageAt: -1 })
    .select("sessionId lastMessageAt messageCount")
    .limit(20);

  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions,
  });
});

const clearSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const chatHistory = await ChatHistory.findOne({
    userId,
    sessionId,
  });

  if (!chatHistory) {
    res.status(404);
    throw new Error("Chat session not found");
  }

  chatHistory.isActive = false;
  await chatHistory.save();

  res.status(200).json({
    success: true,
    message: "Chat session cleared successfully",
  });
});

const getCacheStats = asyncHandler(async (req, res) => {
  const responseCache = require("../agents/responseCache");
  const embeddings = require("../config/embeddings");

  const stats = {
    responseCache: responseCache.getStats(),
    embeddingCache: embeddings.getCacheStats(),
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});

module.exports = {
  sendMessage,
  getGreeting,
  getChatHistory,
  getUserSessions,
  clearSession,
  getCacheStats,
};
