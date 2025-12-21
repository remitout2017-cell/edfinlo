// controllers/nbfcController.js

const NBFC = require("../models/NBFC");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const {
  sendOTPEmail,
  sendSMSOTP,
  verifySMSOTP,
  sendPasswordResetEmail,
} = require("../utils/phoneVerification");
const config = require("../config/config");
const Admin = require("../models/Admin");
const { enqueueNotification } = require("../services/notificationService");
const isDevelopment = config.env === "development";

/**
 * @desc Register new NBFC
 * @route POST /api/nbfc/register
 * @access Public
 */
exports.registerNBFC = async (req, res, next) => {
  try {
    const {
      companyName,
      brandName,
      email,
      password,
      phoneNumber,
      registrationNumber,
      gstNumber,
      contactPerson,
      address,
    } = req.body;

    // Check if NBFC already exists
    const existingNBFC = await NBFC.findOne({
      $or: [
        { email },
        { companyName },
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    });

    if (existingNBFC) {
      let message = "NBFC already exists";
      if (existingNBFC.email === email) {
        message = "Email already registered";
      } else if (existingNBFC.companyName === companyName) {
        message = "Company name already registered";
      } else if (existingNBFC.phoneNumber === phoneNumber) {
        message = "Phone number already registered";
      }

      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Create NBFC instance but don't save yet
    const nbfc = new NBFC({
      companyName,
      brandName,
      email,
      password,
      phoneNumber,
      registrationNumber,
      gstNumber,
      contactPerson,
      address,  
      isEmailVerified: isDevelopment,
      isPhoneVerified: isDevelopment,
    });

    // Generate and set email OTP
    const emailOTP = nbfc.generateOTP();
    nbfc.emailVerificationToken = crypto
      .createHash("sha256")
      .update(emailOTP)
      .digest("hex");
    nbfc.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Try sending email OTP
    try {
      await sendOTPEmail(email, emailOTP, "email");
    } catch (err) {
      console.error("Email OTP sending failed:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to send email OTP. NBFC not registered.",
      });
    }

    // Try sending SMS OTP if phone provided
    if (phoneNumber) {
      try {
        await sendSMSOTP(phoneNumber);
      } catch (err) {
        console.error("SMS OTP sending failed:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to send SMS OTP. NBFC not registered.",
        });
      }
    }

    // Save NBFC only after all OTPs are sent successfully
    await nbfc.save();

    try {
      const admins = await Admin.find({ isActive: true }).select(
        "_id role email"
      );

      const displayName = nbfc.companyName || nbfc.email;

      await Promise.all(
        admins.map((admin) =>
          enqueueNotification({
            recipientId: admin._id.toString(),
            recipientModel: "Admin",
            type: "NBFC_REGISTERED",
            title: "New NBFC registered",
            message: `${displayName} has registered as a new NBFC.`,
            data: {
              nbfcEmail: nbfc.email,
              nbfcCompanyName: displayName,
              adminRole: admin.role,
            },
          })
        )
      );
    } catch (e) {
      console.error(
        "⚠️ Failed to enqueue admin notifications for NBFC register:",
        e.message
      );
    }

    res.status(201).json({
      success: true,
      message:
        "NBFC registered successfully. Please verify your email and phone (if provided).",
      nbfc: {
        id: nbfc._id,
        companyName: nbfc.companyName,
        email: nbfc.email,
        isApprovedByAdmin: nbfc.isApprovedByAdmin,
      },
    });
  } catch (error) {
    console.error("❌ NBFC registration error:", error);
    next(error);
  }
};

/**
 * @desc Verify NBFC email OTP
 * @route POST /api/nbfc/verify-email
 * @access Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const nbfc = await NBFC.findOne({
      email,
      emailVerificationToken: hashedOTP,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!nbfc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    nbfc.isEmailVerified = true;
    nbfc.emailVerificationToken = undefined;
    nbfc.emailVerificationExpire = undefined;
    await nbfc.save();

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("❌ Email verification error:", error);
    next(error);
  }
};

/**
 * @desc Verify NBFC phone OTP
 * @route POST /api/nbfc/verify-phone
 * @access Public
 */
exports.verifyPhone = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const isValid = await verifySMSOTP(phoneNumber, otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const nbfc = await NBFC.findOne({ phoneNumber });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    nbfc.isPhoneVerified = true;
    await nbfc.save();

    res.json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (error) {
    console.error("❌ Phone verification error:", error);
    next(error);
  }
};

/**
 * @desc Resend email OTP
 * @route POST /api/nbfc/resend-email-otp
 * @access Public
 */
exports.resendEmailOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const nbfc = await NBFC.findOne({ email });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    if (nbfc.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const emailOTP = nbfc.generateOTP();
    nbfc.emailVerificationToken = crypto
      .createHash("sha256")
      .update(emailOTP)
      .digest("hex");
    nbfc.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await nbfc.save();

    if (!isDevelopment) {
      sendOTPEmail(nbfc.email, emailOTP, "email").catch(console.error);
    } else {
      console.log(`Dev: New Email OTP for ${email}: ${emailOTP}`);
    }

    res.status(200).json({
      success: true,
      message: "Email OTP sent successfully",
    });
  } catch (error) {
    console.error("❌ Resend email OTP error:", error);
    next(error);
  }
};

/**
 * @desc Resend phone OTP
 * @route POST /api/nbfc/resend-phone-otp
 * @access Public
 */
exports.resendPhoneOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const nbfc = await NBFC.findOne({ phoneNumber });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    if (nbfc.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone already verified",
      });
    }

    try {
      await sendSMSOTP(phoneNumber);
      res.status(200).json({
        success: true,
        message: "SMS OTP sent successfully",
      });
    } catch (error) {
      console.error("SMS resend failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send SMS OTP",
      });
    }
  } catch (error) {
    console.error("❌ Resend phone OTP error:", error);
    next(error);
  }
};

/**
 * @desc NBFC login
 * @route POST /api/nbfc/login
 * @access Public
 */
exports.loginNBFC = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find NBFC and include password
    const nbfc = await NBFC.findOne({ email }).select("+password");

    if (!nbfc || !(await nbfc.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if email is verified
    if (!nbfc.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
        requiresVerification: true,
        verificationType: "email",
      });
    }

    // Check if phone is verified (if phone exists and not in dev mode)
    if (!isDevelopment && nbfc.phoneNumber && !nbfc.isPhoneVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your phone before logging in",
        requiresVerification: true,
        verificationType: "phone",
      });
    }

    // Check if NBFC is active
    if (!nbfc.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Update last login
    nbfc.lastLogin = Date.now();
    await nbfc.save();

    const token = generateToken(nbfc._id, "NBFC");

    res.json({
      success: true,
      message: "Login successful",
      token,
      nbfc: {
        id: nbfc._id,
        companyName: nbfc.companyName,
        brandName: nbfc.brandName,
        email: nbfc.email,
        role: nbfc.role,
        isApprovedByAdmin: nbfc.isApprovedByAdmin,
        isEmailVerified: nbfc.isEmailVerified,
        isPhoneVerified: nbfc.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("❌ NBFC login error:", error);
    next(error);
  }
};

/**
 * @desc Forgot password
 * @route POST /api/nbfc/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const nbfc = await NBFC.findOne({ email });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    const resetToken = nbfc.generateVerificationToken();
    nbfc.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    nbfc.passwordResetExpire = Date.now() + 60 * 60 * 1000; // 60 minutes
    await nbfc.save();

    const resetUrl = `${config.frontendUrl}/nbfc/reset-password/${resetToken}`;
    sendPasswordResetEmail(nbfc.email, resetUrl).catch(console.error);

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    next(error);
  }
};

/**
 * @desc Reset password
 * @route POST /api/nbfc/reset-password
 * @access Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const nbfc = await NBFC.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() },
    });

    if (!nbfc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    nbfc.password = newPassword;
    nbfc.passwordResetToken = undefined;
    nbfc.passwordResetExpire = undefined;
    await nbfc.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    next(error);
  }
};

/**
 * @desc Get NBFC profile
 * @route GET /api/nbfc/profile
 * @access Private (NBFC only)
 */
exports.getNBFCProfile = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.user._id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.json({
      success: true,
      nbfc,
    });
  } catch (error) {
    console.error("❌ Get NBFC profile error:", error);
    next(error);
  }
};

/**
 * @desc Update NBFC loan configuration
 * @route PUT /api/nbfc/loan-config
 * @access Private (NBFC only)
 */
exports.updateLoanConfig = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.user._id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    // Merge new config with existing (deep merge)
    nbfc.loanConfig = {
      ...nbfc.loanConfig.toObject(),
      ...req.body,
    };

    await nbfc.save();

    res.json({
      success: true,
      message: "Loan configuration updated successfully",
      loanConfig: nbfc.loanConfig,
    });
  } catch (error) {
    console.error("❌ Update loan config error:", error);
    next(error);
  }
};

/**
 * @desc Update NBFC profile
 * @route PUT /api/nbfc/profile
 * @access Private (NBFC only)
 */
exports.updateNBFCProfile = async (req, res, next) => {
  try {
    const allowedUpdates = [
      "brandName",
      "phoneNumber",
      "address",
      "contactPerson",
      "gstNumber",
      "registrationNumber",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const nbfc = await NBFC.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      nbfc,
    });
  } catch (error) {
    console.error("❌ Update NBFC profile error:", error);
    next(error);
  }
};

/**
 * @desc Get all NBFCs (admin only)
 * @route GET /api/nbfc/all
 * @access Private (Admin only)
 */
exports.getAllNBFCs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};

    // Filter by approval status
    if (status === "approved") {
      query.isApprovedByAdmin = true;
    } else if (status === "pending") {
      query.isApprovedByAdmin = false;
    }

    // Search by company name or email
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const nbfcs = await NBFC.find(query)
      .select("-password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await NBFC.countDocuments(query);

    res.json({
      success: true,
      count: nbfcs.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      nbfcs,
    });
  } catch (error) {
    console.error("❌ Get all NBFCs error:", error);
    next(error);
  }
};

/**
 * @desc Approve/reject NBFC (admin only)
 * @route PUT /api/nbfc/:id/approve
 * @access Private (Admin only)
 */
exports.approveNBFC = async (req, res, next) => {
  try {
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Approved field must be a boolean",
      });
    }

    const nbfc = await NBFC.findByIdAndUpdate(
      req.params.id,
      { isApprovedByAdmin: approved },
      { new: true }
    );

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.json({
      success: true,
      message: `NBFC ${approved ? "approved" : "rejected"} successfully`,
      nbfc,
    });
  } catch (error) {
    console.error("❌ Approve NBFC error:", error);
    next(error);
  }
};

/**
 * @desc Toggle NBFC active status (admin only)
 * @route PUT /api/nbfc/:id/toggle-status
 * @access Private (Admin only)
 */
exports.toggleNBFCStatus = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.params.id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    nbfc.isActive = !nbfc.isActive;
    await nbfc.save();

    res.json({
      success: true,
      message: `NBFC ${
        nbfc.isActive ? "activated" : "deactivated"
      } successfully`,
      nbfc,
    });
  } catch (error) {
    console.error("❌ Toggle NBFC status error:", error);
    next(error);
  }
};
