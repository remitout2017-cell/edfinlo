// middlewares/iskycverified.js
const jwt = require("jsonwebtoken");
const User = require("../models/students");
const { AppError } = require("./errorMiddleware");
const config = require("../config/config");

// Middleware to check if user has verified KYC
exports.iskycverified = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Authentication required. Please log in.", 401));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return next(
          new AppError("Your session has expired. Please log in again.", 401)
        );
      }
      if (jwtError.name === "JsonWebTokenError") {
        return next(new AppError("Invalid authentication token.", 401));
      }
      return next(jwtError);
    }

    // ✅ FIXED: Get user without mixing inclusion/exclusion
    // Method 1: Only use exclusion
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // Check if user account is active
    if (!user.isActive) {
      return next(new AppError("Your account has been deactivated.", 403));
    }

    // Check KYC status
    if (user.kycStatus !== "verified") {
      const message =
        user.kycStatus === "rejected"
          ? "Your KYC verification failed. Please re-upload your documents."
          : user.kycStatus === "manual_review"
          ? "Your KYC is under manual review. Please wait for approval."
          : "Please verify your KYC first.";

      return res.status(403).json({
        success: false,
        error: message,
        kycStatus: user.kycStatus,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("❌ KYC verification middleware error:", error.message);
    next(new AppError("Authentication failed", 500));
  }
};
