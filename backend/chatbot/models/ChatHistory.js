// chatbot/models/ChatHistory.js
const mongoose = require("mongoose");

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['User', 'Consultant', 'NBFC']
  },
  userRole: {
    type: String,
    required: true,
    enum: ['student', 'consultant', 'nbfc']
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    intent: String,
    fromCache: {
      type: Boolean,
      default: false
    },
    metadata: {
      tokensUsed: Number,
      responseTime: Number,
    }
  }],
  messageCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
chatHistorySchema.index({ userId: 1, sessionId: 1 });
chatHistorySchema.index({ userRole: 1, isActive: 1 });
chatHistorySchema.index({ lastMessageAt: -1 });

// Rate limiting helper
chatHistorySchema.statics.getMessageCount = async function(userId, timeWindow) {
  const since = new Date(Date.now() - timeWindow);
  
  const result = await this.aggregate([
    {
      $match: {
        userId: userId,
        lastMessageAt: { $gte: since }
      }
    },
    {
      $unwind: "$messages"
    },
    {
      $match: {
        "messages.role": "user",
        "messages.timestamp": { $gte: since }
      }
    },
    {
      $count: "total"
    }
  ]);

  return result[0]?.total || 0;
};

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
