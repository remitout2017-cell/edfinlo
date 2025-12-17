// middlewares/validationMiddleware.js
const { validationResult } = require('express-validator');
const config = require('../config/config');

exports.validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Log validation failures for monitoring
    console.warn(`⚠️ Validation failed for ${req.method} ${req.path}:`, {
      ip: req.ip,
      errors: errors.array(),
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: config.env === 'development' ? err.value : undefined,
      })),
    });
  }

  next();
};

// Request sanitization helper
exports.sanitizeRequest = (req, res, next) => {
  // Remove undefined and null values from body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (
        req.body[key] === undefined ||
        req.body[key] === null ||
        req.body[key] === ''
      ) {
        delete req.body[key];
      }
    });
  }

  next();
};
