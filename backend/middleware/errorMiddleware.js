// middleware/errorMiddleware.js - COMPLETE WITH 404 + TIMEOUT FIX

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * ✅ NEW: Global request timeout middleware (3min for AI processing)
 */
const requestTimeout = (ms = 180000) => {
  return (req, res, next) => {
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: `Request timeout (${
            ms / 1000
          }s). Large PDFs take up to 3min. Try smaller files (<10MB).`,
          code: "REQUEST_TIMEOUT",
          retryAfter: 10,
        });
      }
    }, ms);

    req.on("close", () => clearTimeout(timeoutId));
    next();
  };
};

/**
 * ✅ 404 NOT FOUND Handler (YOUR EXISTING CODE)
 */
const notFound = (req, res) =>
  res.status(404).json({
    success: false,
    message: "Route not found",
  });

/**
 * ✅ Error Handler (YOUR EXISTING CODE + ENHANCED)
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  error.message = err.message;

  // ✅ Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = new AppError(message, 404);
  }

  // ✅ Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Duplicate field value entered";
    error = new AppError(message, 400);
  }

  // ✅ Mongoose validation
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new AppError(message, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
  });
};

/**
 * ✅ ENHANCED AppError - Backward compatible
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  asyncHandler,
  AppError,
  requestTimeout,
  notFound, // ✅ YOUR 404 HANDLER
  errorHandler, // ✅ YOUR ERROR HANDLER
};
