// utils/generateToken.js

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config/config");

/**
 * Generate ACCESS JWT with role
 * @param {string} userId
 * @param {string} role - student | admin | nbfc | consultant
 * @returns {string}
 */
const generateAccessToken = (userId, role = "student") => {
  if (!config.jwt?.secret) {
    throw new Error("JWT_SECRET is required");
  }

  const payload = {
    sub: userId, // standard subject
    role, // RBAC
    jti: crypto.randomUUID(), // token identifier
  };

  return jwt.sign(payload, config.jwt.secret, {
    algorithm: "HS256",
    expiresIn: config.jwt.expiresIn || "7d", // SHORT lived
    issuer: "student-loan",
  });
};

module.exports = generateAccessToken;
