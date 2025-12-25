// chatbot/controllers/chatbot.controller.js
const asyncHandler = require("express-async-handler");
const chatbot = require("../agents/chatbotGraph");
const ChatHistory = require("../models/ChatHistory");
const { RATE_LIMITS } = require("../config/chatbotConfig");
const { v4: uuidv4 } = require('uuid');

// @desc    Send message to chatbot
// @route   POST /api/chatbot/message
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;
  const startTime = Date.now();

  if (!message || message.trim() === '') {
    res.status(400);
    throw new Error("Message is required");
  }

  // Determine user role and model
  const userRole = req.user.role || 'student';
  const userId = req.user._id;
  
  let userModel = 'User';
  if (userRole === 'consultant') userModel = 'Consultant';
  if (userRole === 'nbfc') userModel = 'NBFC';

  // Rate limiting check
  const limits = RATE_LIMITS[userRole];
  const hourlyCount = await ChatHistory.getMessageCount(userId, 60 * 60 * 1000);
  
  if (hourlyCount >= limits.maxMessagesPerHour) {
    res.status(429);
    throw new Error(`Rate limit exceeded. Maximum ${limits.maxMessagesPerHour} messages per hour.`);
  }

  // Session management
  const currentSessionId = sessionId || uuidv4();

  let chatHistory = await ChatHistory.findOne({
    userId,
    sessionId: currentSessionId,
    isActive: true
  });

  if (!chatHistory) {
    chatHistory = new ChatHistory({
      userId,
      userModel,
      userRole,
      sessionId: currentSessionId,
      messages: []
    });
  }

  // Convert to conversation history
  const conversationHistory = chatHistory.messages
    .slice(-6) // Keep last 6 messages
    .map(msg => ({
      role: msg.role === 'user' ? 'human' : 'ai',
      content: msg.content
    }));

  // Get chatbot response
  const result = await chatbot.chat(message, userRole, conversationHistory);
  const responseTime = Date.now() - startTime;

  // Save to history
  chatHistory.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
    intent: result.intent,
    metadata: { responseTime: 0 }
  });

  chatHistory.messages.push({
    role: 'assistant',
    content: result.response,
    timestamp: new Date(),
    fromCache: result.fromCache || false,
    metadata: { responseTime }
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
    }
  });
});

// @desc    Get chat greeting
// @route   GET /api/chatbot/greeting
// @access  Private
const getGreeting = asyncHandler(async (req, res) => {
  const userRole = req.user.role || 'student';
  const greeting = chatbot.getGreeting(userRole);

  res.status(200).json({
    success: true,
    data: { greeting }
  });
});

// @desc    Get chat history
// @route   GET /api/chatbot/history/:sessionId
// @access  Private
const getChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const chatHistory = await ChatHistory.findOne({
    userId,
    sessionId,
    isActive: true
  });

  if (!chatHistory) {
    res.status(404);
    throw new Error("Chat session not found");
  }

  res.status(200).json({
    success: true,
    data: chatHistory
  });
});

// @desc    Get all user sessions
// @route   GET /api/chatbot/sessions
// @access  Private
const getUserSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sessions = await ChatHistory.find({
    userId,
    isActive: true
  })
    .sort({ lastMessageAt: -1 })
    .select('sessionId lastMessageAt messageCount')
    .limit(20);

  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions
  });
});

// @desc    Clear chat session
// @route   DELETE /api/chatbot/session/:sessionId
// @access  Private
const clearSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const chatHistory = await ChatHistory.findOne({
    userId,
    sessionId
  });

  if (!chatHistory) {
    res.status(404);
    throw new Error("Chat session not found");
  }

  chatHistory.isActive = false;
  await chatHistory.save();

  res.status(200).json({
    success: true,
    message: "Chat session cleared successfully"
  });
});

// @desc    Get cache stats (admin only)
// @route   GET /api/chatbot/stats
// @access  Private/Admin
const getCacheStats = asyncHandler(async (req, res) => {
  const responseCache = require("../agents/responseCache");
  const embeddings = require("../config/embeddings");

  const stats = {
    responseCache: responseCache.getStats(),
    embeddingCache: embeddings.getCacheStats(),
  };

  res.status(200).json({
    success: true,
    data: stats
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
