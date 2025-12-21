// controllers/consultant/consultant.auth.controller.js
const Consultant = require("../../models/consultant/Consultant");
const crypto = require("crypto");
const generateToken = require("../../utils/generateToken");
const { sendOTPEmail } = require("../../utils/phoneVerification");

// @desc    Register new Consultant
// @route   POST /api/consultant/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, companyName } =
      req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email, and password are required",
      });
    }

    // Check if consultant already exists
    const existingConsultant = await Consultant.findOne({
      email: email.toLowerCase(),
    });

    if (existingConsultant) {
      return res.status(400).json({
        success: false,
        message: "Consultant with this email already exists",
      });
    }

    // Create consultant
    const consultant = await Consultant.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      companyName,
    });

    // Generate token
    const token = generateToken(consultant._id, consultant.role);

    res.status(201).json({
      success: true,
      message: "Consultant registered successfully",
      data: {
        token,
        consultant: {
          id: consultant._id,
          firstName: consultant.firstName,
          lastName: consultant.lastName,
          email: consultant.email,
          role: consultant.role,
          companyName: consultant.companyName,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login Consultant
// @route   POST /api/consultant/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find consultant with password
    const consultant = await Consultant.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!consultant || !(await consultant.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!consultant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact support.",
      });
    }

    // Update last login
    consultant.lastLogin = new Date();
    await consultant.save();

    // Generate token
    const token = generateToken(consultant._id, consultant.role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        consultant: {
          id: consultant._id,
          firstName: consultant.firstName,
          lastName: consultant.lastName,
          email: consultant.email,
          role: consultant.role,
          companyName: consultant.companyName,
          lastLogin: consultant.lastLogin,
          stats: consultant.stats,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Send OTP to email
// @route   POST /api/consultant/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const consultant = await Consultant.findOne({ email: email.toLowerCase() });

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "No consultant found with this email",
      });
    }

    // Generate 6-digit OTP
    const otp = consultant.generateOTP();

    // Hash OTP and store
    consultant.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    consultant.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await consultant.save();

    // Send OTP via email
    try {
      await sendOTPEmail(consultant.email, otp, "password reset");

      res.status(200).json({
        success: true,
        message: "Password reset OTP sent to your email",
      });
    } catch (error) {
      consultant.passwordResetOTP = undefined;
      consultant.passwordResetOTPExpire = undefined;
      await consultant.save();

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and Reset Password
// @route   POST /api/consultant/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    // Hash the provided OTP
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Find consultant with matching OTP and not expired
    const consultant = await Consultant.findOne({
      email: email.toLowerCase(),
      passwordResetOTP: hashedOTP,
      passwordResetOTPExpire: { $gt: Date.now() },
    }).select("+passwordResetOTP +passwordResetOTPExpire");

    if (!consultant) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update password
    consultant.password = newPassword;
    consultant.passwordResetOTP = undefined;
    consultant.passwordResetOTPExpire = undefined;
    await consultant.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP
// @route   POST /api/consultant/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const consultant = await Consultant.findOne({ email: email.toLowerCase() });

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "No consultant found with this email",
      });
    }

    // Generate new OTP
    const otp = consultant.generateOTP();
    consultant.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    consultant.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000;
    await consultant.save();

    // Send OTP
    await sendOTPEmail(consultant.email, otp, "password reset");

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current consultant profile
// @route   GET /api/consultant/auth/me
// @access  Private (Consultant only)
exports.getMe = async (req, res, next) => {
  try {
    const consultant = await Consultant.findById(req.user.id).select(
      "-password"
    );

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: consultant,
    });
  } catch (error) {
    next(error);
  }
};
