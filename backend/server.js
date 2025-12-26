// server.js
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("@exortek/express-mongo-sanitize");
const { xss } = require("express-xss-sanitizer");
const statusMonitor = require("express-status-monitor");
const cron = require("node-cron");
const path = require("path");
const corsOptions = require("./config/cors");
const config = require("./config/config");
const connectDB = require("./config/database");
const vectorStoreManager = require("./chatbot/config/vectorStore");

const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const academicRoutes = require("./routes/students/academic.routes");
const workExperienceRoutes = require("./routes/students/workexperience.routes"); // ✅ ADD THIS
const testScoresRoutes = require("./routes/students/testscores.routes"); // ✅ NEW
const coBorrowerRoutes = require("./routes/students/coborrower.routes");
const {
  otpLimiter,
  authLimiter,
  apiLimiter,
} = require("./middleware/rateLimit");

const admissionRoutes = require("./routes/students/admission.routes");
const {
  cleanupOldTempFiles,
  getDirectorySize, // ✅ Make sure this is imported
  emergencyCleanup, // ✅ And this too if you need it
} = require("./utils/fileCleanup");
const app = express();
app.set("trust proxy", 1);
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (config.env === "development") {
  app.use(statusMonitor());
}

app.use(
  helmet({
    contentSecurityPolicy: config.env === "production",
    crossOriginEmbedderPolicy: false,
  })
);

app.use(mongoSanitize());
app.use(xss());
app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
    level: 6,
  })
);

// Request logging in development
if (config.env === "development") {
  app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// ✅ ROUTES FIRST (must come before notFound/errorHandler)
// Auth routes use authLimiter (20 requests/15 min)
app.use("/api/auth", authLimiter, require("./routes/students/auth.routes"));

// User routes use apiLimiter (100 requests/15 min)
app.use("/api/user", apiLimiter, require("./routes/students/userRoutes"));
app.use(
  "/api/user/educationplanet",
  apiLimiter,
  require("./routes/students/studentEducationPlanRoutes")
);
app.use("/api/user/kyc", apiLimiter, require("./routes/students/kyc.routes"));
app.use("/api/user/academics", apiLimiter, academicRoutes);
app.use("/api/user/admission", apiLimiter, admissionRoutes);
app.use("/api/user/workexperience", apiLimiter, workExperienceRoutes);
app.use("/api/user/testscores", apiLimiter, testScoresRoutes);
app.use("/api/coborrower", apiLimiter, coBorrowerRoutes);

// NBFC auth uses authLimiter
app.use(
  "/api/nbfc/auth",
  authLimiter,
  require("./routes/nbfc/nbfc.auth.routes")
);
app.use(
  "/api/nbfc",
  apiLimiter,
  require("./routes/nbfc/nbfc.questionnaire.routes")
);

// Consultant auth uses authLimiter
app.use(
  "/api/consultant/auth",
  authLimiter,
  require("./routes/consultant/consultant.auth.routes")
);
app.use(
  "/api/consultant/students",
  require("./routes/consultant/consultant.students.routes")
);
app.use(
  "/api/student/loan-matching",
  apiLimiter,
  require("./routes/students/loanMatching.routes")
);

// Loan analysis routes (alias for frontend compatibility)
app.use(
  "/api/loan-analysis",
  apiLimiter,
  require("./routes/students/loanMatching.routes")
);

// NBFC loan requests
app.use(
  "/api/nbfc/loan-requests",
  apiLimiter,
  require("./routes/nbfc/loanRequest.routes")
);

// ✅ Chatbot routes (must come BEFORE error handlers)
app.use("/api/chatbot", apiLimiter, require("./chatbot/routes/chatbot.routes"));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// ✅ 404 + error handler LAST
app.use(notFound);
app.use(errorHandler);

// DB connect after middleware setup is fine, but ensure it's called once
connectDB();
// After connectDB(), add:
(async () => {
  try {
    console.log("🤖 Initializing AI chatbot...");
    const vectorStoreManager = require("./chatbot/config/vectorStore");
    const chatbot = require("./chatbot/agents/chatbotGraph");

    await vectorStoreManager.initialize();
    await chatbot.initialize();

    console.log("✅ AI chatbot ready!");
  } catch (error) {
    console.error("❌ Chatbot initialization failed:", error);
    console.log("⚠️ Server will continue without chatbot features");
  }
})();

cron.schedule("0 * * * *", async () => {
  // Every hour at minute 0
  console.log("🕒 Running hourly temp file cleanup...");
  await cleanupOldTempFiles();
});

// Run more frequent cleanup during peak hours (optional)
cron.schedule("*/10 * * * *", async () => {
  // Every 15 minutes
  console.log("🔄 Running frequent temp file check...");
  const stats = await getDirectorySize(UPLOADS_DIR);
  const dirSizeMB = stats.size / (1024 * 1024);

  if (dirSizeMB > 500) {
    // If directory exceeds 500MB
    console.log(
      `⚠️ Directory large (${dirSizeMB.toFixed(2)}MB), triggering cleanup`
    );
    await cleanupOldTempFiles();
  }
});

cron.schedule("0 0 * * *", async () => {
  console.log("📊 Daily cleanup report:");
  const stats = await getDirectorySize(UPLOADS_DIR);
  console.log(
    `📁 Uploads directory: ${stats.files} files, ${(
      stats.size /
      (1024 * 1024)
    ).toFixed(2)}MB`
  );
});

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║ 🚀Server Started Successfully         ║
╠═══════════════════════════════════════╣
║ Environment: ${config.env}            ║
║ Port: ${PORT}                         ║
║ Time: ${new Date().toLocaleString()}  ║
╚═══════════════════════════════════════╝
`);
});

server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;
  switch (error.code) {
    case "EACCES":
      console.error(`❌ Port ${PORT} requires elevated privileges`);
      process.exit(1);
    case "EADDRINUSE":
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
});

const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("✅ HTTP server closed");
    try {
      await require("mongoose").connection.close(false);
      console.log("✅ MongoDB connections closed");
      console.log("👋 Graceful shutdown completed");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error during shutdown:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error("Stack:", err.stack);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("warning", (warning) => {
  console.warn("⚠️ Warning:", warning.name, warning.message);
});

module.exports = app;
