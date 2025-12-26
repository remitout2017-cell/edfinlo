// controllers/nbfc/nbfc.auth.controller.js
const NBFC = require("../../models/nbfc/NBFC");
const crypto = require("crypto");
const generateToken = require("../../utils/generateToken");
const { sendOTPEmail } = require("../../utils/phoneVerification");

// @desc    Register new NBFC
// @route   POST /api/nbfc/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { companyName, email, password, phoneNumber, contactPerson } =
      req.body;

    // Validation
    if (!companyName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Company name, email, and password are required",
      });
    }

    // Check if NBFC already exists
    const existingNBFC = await NBFC.findOne({
      $or: [{ email: email.toLowerCase() }, { companyName }],
    });

    if (existingNBFC) {
      return res.status(400).json({
        success: false,
        message: "NBFC with this email or company name already exists",
      });
    }

    // Create NBFC
    const nbfc = await NBFC.create({
      companyName,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      contactPerson,
      questionnaireCompleted: false,
    });

    // Generate token
    const token = generateToken(nbfc._id, nbfc.role);

    res.status(201).json({
      success: true,
      message:
        "NBFC registered successfully. Please complete the questionnaire.",
      data: {
        token,
        nbfc: {
          id: nbfc._id,
          companyName: nbfc.companyName,
          email: nbfc.email,
          role: nbfc.role,
          questionnaireCompleted: nbfc.questionnaireCompleted,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login NBFC
// @route   POST /api/nbfc/auth/login
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

    // Find NBFC with password
    const nbfc = await NBFC.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!nbfc || !(await nbfc.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!nbfc.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact support.",
      });
    }

    // Update last login
    nbfc.lastLogin = new Date();
    await nbfc.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(nbfc._id, nbfc.role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        nbfc: {
          id: nbfc._id,
          companyName: nbfc.companyName,
          email: nbfc.email,
          role: nbfc.role,
          questionnaireCompleted: nbfc.questionnaireCompleted,
          lastLogin: nbfc.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Send OTP to email
// @route   POST /api/nbfc/auth/forgot-password
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

    const nbfc = await NBFC.findOne({ email: email.toLowerCase() });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "No NBFC found with this email",
      });
    }

    // Generate 6-digit OTP
    const otp = nbfc.generateOTP();

    // Hash OTP and store
    nbfc.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    nbfc.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await nbfc.save({ validateBeforeSave: false });

    // Send OTP via email
    try {
      await sendOTPEmail(nbfc.email, otp, "password reset");

      res.status(200).json({
        success: true,
        message: "Password reset OTP sent to your email",
      });
    } catch (error) {
      nbfc.passwordResetOTP = undefined;
      nbfc.passwordResetOTPExpire = undefined;
      await nbfc.save();

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
// @route   POST /api/nbfc/auth/reset-password
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

    // Find NBFC with matching OTP and not expired
    const nbfc = await NBFC.findOne({
      email: email.toLowerCase(),
      passwordResetOTP: hashedOTP,
      passwordResetOTPExpire: { $gt: Date.now() },
    }).select("+passwordResetOTP +passwordResetOTPExpire");

    if (!nbfc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update password
    nbfc.password = newPassword;
    nbfc.passwordResetOTP = undefined;
    nbfc.passwordResetOTPExpire = undefined;
    await nbfc.save({ validateBeforeSave: false });

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
// @route   POST /api/nbfc/auth/resend-otp
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

    const nbfc = await NBFC.findOne({ email: email.toLowerCase() });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "No NBFC found with this email",
      });
    }

    // Generate new OTP
    const otp = nbfc.generateOTP();
    nbfc.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    nbfc.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000;
    await nbfc.save({ validateBeforeSave: false });

    // Send OTP
    await sendOTPEmail(nbfc.email, otp, "password reset");

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    next(error);
  }
};
