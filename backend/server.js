// server.js
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("@exortek/express-mongo-sanitize");
const { xss } = require("express-xss-sanitizer");
const statusMonitor = require("express-status-monitor");

const corsOptions = require("./config/cors");
const config = require("./config/config");
const connectDB = require("./config/database");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const academicRoutes = require("./routes/students/academic.routes");

const app = express();
app.set("trust proxy", 1);

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
app.use("/api/auth", require("./routes/students/auth.routes"));
app.use("/api/user", require("./routes/students/userRoutes"));
app.use(
  "/api/user/educationplanet",
  require("./routes/students/studentEducationPlanRoutes")
);
app.use("/api/user/kyc", require("./routes/students/kyc.routes"));
app.use("/api/user/academics",academicRoutes)
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

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║ 🚀 Server Started Successfully        ║
╠═══════════════════════════════════════╣
║ Environment: ${config.env}
║ Port: ${PORT}
║ Time: ${new Date().toLocaleString()}
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
