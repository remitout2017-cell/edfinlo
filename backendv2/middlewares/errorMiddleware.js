// middleware/errorMiddleware.js

const config = require("../config/config");

// Custom error class for better error handling
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
exports.errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error with context
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    error: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
  };
  console.error('🔴 ERROR:', JSON.stringify(errorLog, null, 2));

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    error.message = `Resource not found with id: ${err.value}`;
    error.statusCode = 404;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error.message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error.message = 'Validation failed';
    error.statusCode = 400;
    error.errors = errors;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token. Please log in again.';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Your token has expired. Please log in again.';
    error.statusCode = 401;
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    error.message = 'Database connection error. Please try again.';
    error.statusCode = 503;
  }

  // Rate limit errors
  if (err.name === 'TooManyRequests') {
    error.message = 'Too many requests. Please try again later.';
    error.statusCode = 429;
  }

  // OTP-specific errors
  if (err.message?.toLowerCase().includes('otp')) {
    error.statusCode = 400;
  }

  // Request timeout
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    error.message = 'Request timeout. Please try again.';
    error.statusCode = 408;
  }

  // Axios/HTTP errors from external services
  if (err.isAxiosError) {
    error.message = err.response?.data?.message || 'External service error';
    error.statusCode = err.response?.status || 503;
  }

  // Response structure
  const response = {
    success: false,
    error: error.message || 'Internal Server Error',
    statusCode: error.statusCode,
    ...(error.errors && { errors: error.errors }),
    ...(config.env === 'development' && {
      stack: err.stack,
      originalError: err,
    }),
  };

  // Don't expose sensitive errors in production
  if (config.env === 'production' && !error.isOperational) {
    response.error = 'Something went wrong. Please try again.';
  }

  res.status(error.statusCode).json(response);
};

// Async error wrapper to avoid try-catch in every controller
exports.asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
exports.notFound = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

// Export AppError for use in controllers
exports.AppError = AppError;
