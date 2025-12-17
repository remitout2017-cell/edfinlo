// middlewares/authMiddleware.js

const jwt = require("jsonwebtoken");
const User = require("../models/students");
const NBFC = require("../models/NBFC");
const Admin = require("../models/Admin");
const Consultant = require("../models/Consultant");
const { AppError } = require("./errorMiddleware"); // ✅ FIXED: named import
const config = require("../config/config");

// Map token role -> Mongoose model
const roleModelMap = {
  student: User,
  user: User,
  nbfc: NBFC,
  NBFC: NBFC,
  admin: Admin,
  superadmin: Admin,
  subadmin: Admin,
  consultant: Consultant,
  CONSULTANT: Consultant,
};

/**
 * Protect routes - require authentication
 * Supports multiple user roles: student, NBFC, admin, consultant
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer")) {
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

    // Determine which model to use based on role in token
    const role = decoded.role || "student";
    const Model = roleModelMap[role] || User;

    // Get user from token
    const user = await Model.findById(decoded.id).select("-password");

    if (!user) {
      return next(
        new AppError("User associated with this token no longer exists.", 401)
      );
    }

    // Check if email is verified for entities that support it
    if (typeof user.isEmailVerified === "boolean" && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email is not verified",
        requiresVerification: true,
        verificationType: "email",
      });
    }

    // Check if phone is verified (skip in development)
    const isDevelopment = config.env === "development";
    if (
      !isDevelopment &&
      user.phoneNumber &&
      typeof user.isPhoneVerified === "boolean" &&
      !user.isPhoneVerified
    ) {
      return res.status(403).json({
        success: false,
        message: "Phone number is not verified",
        requiresVerification: true,
        verificationType: "phone",
      });
    }

    // Check if account is active
    if (typeof user.isActive === "boolean" && !user.isActive) {
      return next(
        new AppError("Your account has been deactivated. Contact support.", 403)
      );
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Restrict access to specific roles
 * Usage: restrictTo('admin', 'NBFC', 'consultant')
 */
exports.restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    const normalizedAllowedRoles = allowedRoles.map((role) =>
      role.toLowerCase()
    );
    const userRole = req.user?.role?.toLowerCase();

    if (!normalizedAllowedRoles.includes(userRole)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    next();
  };
};

/**
 * Permission guard for admins / sub-admins
 * Usage: authorizePermissions('nbfcs:read', 'students:read')
 */
exports.authorizePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    const role = req.user?.role?.toLowerCase() || "";
    const adminRoles = ["admin", "superadmin", "subadmin"];

    // Only apply permission checks to admin roles
    if (!adminRoles.includes(role)) {
      return next();
    }

    // Superadmin can do everything
    if (role === "superadmin") {
      return next();
    }

    // Normalize permissions: support array or comma-separated string
    let userPermissions = [];

    if (Array.isArray(req.user?.permissions)) {
      userPermissions = req.user.permissions;
    } else if (typeof req.user?.permissions === "string") {
      userPermissions = req.user.permissions
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }

    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasAll) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    next();
  };
};

/**
 * Check if email is verified (for already-authenticated user)
 */
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    return next(
      new AppError("Email verification required to access this resource.", 403)
    );
  }
  next();
};

/**
 * Check if phone is verified (for already-authenticated user)
 */
exports.requirePhoneVerification = (req, res, next) => {
  if (!req.user?.isPhoneVerified) {
    return next(
      new AppError("Phone verification required to access this resource.", 403)
    );
  }
  next();
};

/**
 * Check if NBFC is approved by admin
 */
exports.requireAdminApproval = (req, res, next) => {
  if (
    req.user?.role &&
    req.user.role.toLowerCase() === "nbfc" &&
    !req.user.isApprovedByAdmin
  ) {
    return next(
      new AppError(
        "Your NBFC account is pending admin approval. Please wait for approval.",
        403
      )
    );
  }
  next();
};

/**
 * Optional authentication - doesn't fail if no / invalid token
 * Useful for public routes that have different behavior for authenticated users
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      // Continue without user
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      // If token is invalid/expired, just continue without user
      return next();
    }

    const role = decoded.role || "student";
    const Model = roleModelMap[role] || User;

    const user = await Model.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // If anything goes wrong, continue without user
    next();
  }
};
