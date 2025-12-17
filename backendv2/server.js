// server.js
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("@exortek/express-mongo-sanitize");
const { xss } = require("express-xss-sanitizer");
const rateLimit = require("express-rate-limit");
const statusMonitor = require("express-status-monitor");
const studentEducationPlanRoutes = require("./routes/studentEducationPlanRoutes");
const workExpRoutesV2 = require("./routesv2/workExperienceRoutes");
const coBorrowerRoutesV2 = require("./routesv2/coBorrowerRoutes");

const workExperienceRoutes = require("./routes/workExperienceRoutes");
const admissionRoutes = require("./routes/admissionRoutes");
const connectDB = require("./config/database");
const config = require("./config/config");
const { errorHandler, notFound } = require("./middlewares/errorMiddleware");
const uploadRoutes = require("./routes/kycroutes");
const academicRecordsRoutes = require("./routes/academicRecordsRoutes");
const nbfcRoutes = require("./routes/nbfcRoutes");
const loanAnalysisRoutes = require("./routes/loanAnalysisRoutes");
const consultantRoutes = require("./routes/consultantRoutes"); // add this
const adminRoutes = require("./routes/adminRoutes"); // add this
const { initNotificationWorker } = require("./queues/notificationQueue");
const loanRequestRoutes = require("./routes/loanRequestRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const kycRoutesV2 = require('./routesv2/kycRoutes'); // Version 2 (New)
const academicRecordsRoutesV2 = require('./routesv2/academicRecordsRoutes'); // Version 2 (New)
const loanAnalysisRoutesV2 = require('./routesv2/loanAnalysisRoutes'); // Version 2 (New)
// const kycroutev2 = require("./routesv2/kycRoutes")
const requiredConfig = {
  JWT_SECRET: config.jwt.secret,
  MONGO_URI: config.mongoUri,
  EMAIL_USER: config.email.user,
  EMAIL_PASSWORD: config.email.password,
};

const missingEnv = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

// Connect to MongoDB with connection pooling

const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Health check endpoint (before middleware for fast response)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// Status monitoring (only in development or behind auth in production)
if (config.env === "development") {
  app.use(statusMonitor());
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: config.env === "production",
    crossOriginEmbedderPolicy: false,
  })
);
app.use(mongoSanitize());
app.use(xss());

// Rate limiting (auth endpoints stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Too many authentication attempts. Please try again after 15 minutes.",
    });
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.maxRequests,
  message: { success: false, message: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});


// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173", // ✅ Vite default port
      "http://localhost:5174",
      "http://127.0.0.1:3000",
      "https://loanbackend-2-1.onrender.com",
      "http://127.0.0.1:5173", // ✅ Vite default port
      config.frontendUrl,
    ].filter(Boolean); // Remove undefined values

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600, // Cache preflight requests for 10 minutes
};
app.use(cors(corsOptions));

// Body parser with size limits
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

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/kyc", uploadRoutes);
app.use("/api/work-experience", workExperienceRoutes);
app.use("/api/academic", academicRecordsRoutes);
app.use("/api/co-borrower", require("./routes/coBorrowerRoutes"));
app.use("/api/nbfc", nbfcRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admission", admissionRoutes);
app.use("/api/consultant", consultantRoutes); // consultant APIs
app.use("/api/loan-analysis", loanAnalysisRoutes);
app.use("/api/loan-requests", loanRequestRoutes);
app.use("/api/students", studentEducationPlanRoutes);
app.use("/api/v2/co-borrower", coBorrowerRoutesV2);
app.use("/api/v2/loan-analysis", loanAnalysisRoutesV2);
app.use("/api/notifications", notificationRoutes);
app.use("/api/v2/academic", academicRecordsRoutesV2);
app.use("/api/v2/work-experience", workExpRoutesV2);


app.use("/api/v2/kyc", kycRoutesV2)
// API documentation endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MERN Auth API v1.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      kyc: "/api/kyc",
      academic: "/api/academic",
      workExperience: "/api/work-experience",
      coBorrower: "/api/co-borrower",
      nbfc: "/api/nbfc",
      admissionLetter: "/api/admissionletter",
      consultant: "/api/consultant", // ✅ ADDED
      health: "/health",
    },
    documentation: config.apiDocsUrl || "Not configured",
  });
});

// 404 handler (must be after routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);
connectDB().then(() => {
  initNotificationWorker();
});

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`

╔═══════════════════════════════════════╗
║ 🚀 Server Started Successfully       ║
╠═══════════════════════════════════════╣
║ Environment: ${config.env}
║ Port:        ${PORT}
║ Time:        ${new Date().toLocaleString()}
╚═══════════════════════════════════════╝

`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;

  switch (error.code) {
    case "EACCES":
      console.error(`❌ Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Graceful shutdown handlers
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

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error("Stack:", err.stack);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Handle termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle warnings
process.on("warning", (warning) => {
  console.warn("⚠️ Warning:", warning.name, warning.message);
});

module.exports = app; // Export for testing
