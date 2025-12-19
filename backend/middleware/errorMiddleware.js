// middleware/errorMiddleware.js
const config = require("../config/config");

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    error: err.message,
    stack: config.env === "development" ? err.stack : undefined,
  };
  console.error("ERROR", JSON.stringify(errorLog, null, 2));

  let message = err.message || "Internal Server Error";
  let code = statusCode;

  if (err.name === "CastError") {
    message = `Resource not found with id ${err.value}`;
    code = 404;
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    message = `Duplicate field value ${field}=${value}. Please use another value.`;
    code = 400;
  }
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    return res
      .status(400)
      .json({
        success: false,
        error: "Validation failed",
        errors,
        statusCode: 400,
      });
  }
  if (err.name === "JsonWebTokenError") {
    message = "Invalid token. Please log in again.";
    code = 401;
  }
  if (err.name === "TokenExpiredError") {
    message = "Your token has expired. Please log in again.";
    code = 401;
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
    message = "Request timeout. Please try again.";
    code = 408;
  }
  if (err.isAxiosError) {
    message = err.response?.data?.message || "External service error";
    code = err.response?.status || 503;
  }

  const response = {
    success: false,
    error:
      config.env === "production" && !err.isOperational
        ? "Something went wrong. Please try again."
        : message,
    statusCode: code,
    ...(config.env === "development" && { stack: err.stack }),
  };
  return res.status(code).json(response);
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res, next) =>
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));

module.exports = { AppError, errorHandler, asyncHandler, notFound };
