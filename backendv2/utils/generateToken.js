// utils/generateToken.js

const jwt = require("jsonwebtoken");
const config = require("../config/config");

/**
 * Generate JWT token with role support
 * @param {string} userId - User/NBFC ID
 * @param {string} role - User role (default: 'student')
 * @returns {string} JWT token
 */
const generateToken = (userId, role = "student") => {
  if (!config.jwt.secret) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign(
    {
      id: userId,
      role,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn || config.jwt.expire || "30d",
    }
  );
};

module.exports = generateToken;
