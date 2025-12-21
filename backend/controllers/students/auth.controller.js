// controllers/students/student.auth.controller.js
const Student = require("../../models/student/students");
const Consultant = require("../../models/consultant/Consultant");
const crypto = require("crypto");
const generateToken = require("../../utils/generateToken");
const {
  sendOTPEmail,
  sendPasswordResetOTPEmail,
  sendSMSOTP,
  verifySMSOTP,
} = require("../../utils/phoneVerification");
const config = require("../../config/config");

const isDevelopment = config.env === "development";

// @desc    Regular student registration (WITHOUT consultant invitation)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phoneNumber } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email, and password are required",
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student with this email or phone number already exists",
      });
    }

    // Create student
    const student = await Student.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      isEmailVerified: isDevelopment, // Auto-verify in dev
      isPhoneVerified: phoneNumber ? isDevelopment : true, // Auto-verify in dev if phone provided
      role: "student",
    });

    // Generate email OTP if not in dev mode
    if (!isDevelopment && email) {
      const emailOTP = student.generateOTP();
      student.emailVerificationToken = crypto
        .createHash("sha256")
        .update(emailOTP)
        .digest("hex");
      student.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
      await student.save();

      try {
        await sendOTPEmail(email, emailOTP, "email");
      } catch (err) {
        console.error("Failed to send email OTP:", err);
      }
    }

    // Generate phone OTP if phone provided and not in dev mode
    if (!isDevelopment && phoneNumber) {
      try {
        await sendSMSOTP(phoneNumber);
        student.phoneVerificationExpire = Date.now() + 10 * 60 * 1000;
        await student.save();
      } catch (err) {
        console.error("Failed to send SMS OTP:", err);
      }
    }

    // Generate login token
    const token = generateToken(student._id, student.role);

    res.status(201).json({
      success: true,
      message: isDevelopment
        ? "Registration successful! (Auto-verified in dev mode)"
        : "Registration successful! Please verify your email" +
          (phoneNumber ? " and phone number" : ""),
      data: {
        token,
        student: {
          id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          role: student.role,
          isEmailVerified: student.isEmailVerified,
          isPhoneVerified: student.isPhoneVerified,
        },
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// @desc    Register student via consultant invitation
// @route   POST /api/auth/register-from-invite
// @access  Public
exports.registerFromInvite = async (req, res, next) => {
  try {
    const { token, email, firstName, lastName, password, phoneNumber } =
      req.body;

    // Validation
    if (!token || !email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Token, email, first name, last name, and password are required",
      });
    }

    // Find consultant with this invite token
    const consultant = await Consultant.findOne({
      "invitedStudents.token": token,
      "invitedStudents.email": email.toLowerCase(),
    });

    if (!consultant) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invitation token",
      });
    }

    // Find the specific invite
    const invite = consultant.invitedStudents.find(
      (inv) => inv.token === token && inv.email === email.toLowerCase()
    );

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation",
      });
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invitation has expired",
      });
    }

    // Check if already accepted
    if (invite.accepted) {
      return res.status(400).json({
        success: false,
        message: "Invitation already used",
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber }],
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student with this email or phone number already exists",
      });
    }

    // Create student
    const student = await Student.create({
      email: email.toLowerCase(),
      firstName,
      lastName,
      password,
      phoneNumber,
      consultant: consultant._id, // Link to consultant
      isEmailVerified: true,
      isPhoneVerified: phoneNumber ? isDevelopment : true,
      role: "student",
    });

    // Mark invite as accepted
    invite.accepted = true;
    invite.acceptedAt = new Date();

    // Add student to consultant's students array
    consultant.students.push(student._id);
    consultant.stats.totalStudents += 1;
    consultant.stats.activeStudents += 1;
    consultant.stats.pendingInvites = Math.max(
      0,
      consultant.stats.pendingInvites - 1
    );

    await consultant.save();

    // Send OTPs if not in dev mode
    if (!isDevelopment) {
      // Email OTP
      const emailOTP = student.generateOTP();
      student.emailVerificationToken = crypto
        .createHash("sha256")
        .update(emailOTP)
        .digest("hex");
      student.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
      await student.save();

      // try {
      //   await sendOTPEmail(email, emailOTP, "email");
      // } catch (err) {
      //   console.error("Failed to send email OTP:", err);
      // }

      // Phone OTP
      if (phoneNumber) {
        try {
          await sendSMSOTP(phoneNumber);
          student.phoneVerificationExpire = Date.now() + 10 * 60 * 1000;
          await student.save();
        } catch (err) {
          console.error("Failed to send SMS OTP:", err);
        }
      }
    }

    // Generate login token
    const token_response = generateToken(student._id, student.role);

    res.status(201).json({
      success: true,
      message: isDevelopment
        ? "Registration successful! (Auto-verified in dev mode)"
        : "Registration successful! Please verify your email" +
          (phoneNumber ? " and phone number" : ""),
      data: {
        token: token_response,
        student: {
          id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          phoneNumber: student.phoneNumber,
          role: student.role,
          consultant: {
            id: consultant._id,
            name: `${consultant.firstName} ${consultant.lastName}`,
            companyName: consultant.companyName,
          },
          isEmailVerified: student.isEmailVerified,
          isPhoneVerified: student.isPhoneVerified,
        },
      },
    });
  } catch (error) {
    console.error("Register from invite error:", error);
    next(error);
  }
};

// @desc    Student login
// @route   POST /api/auth/login
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

    // Find student with password
    const student = await Student.findOne({ email: email.toLowerCase() })
      .select("+password")
      .populate("consultant", "firstName lastName companyName");

    if (!student || !(await student.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!student.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Contact support.",
      });
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    // Generate token
    const token = generateToken(student._id, student.role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        student: {
          id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          role: student.role,
          isEmailVerified: student.isEmailVerified,
          isPhoneVerified: student.isPhoneVerified,
          kycStatus: student.kycStatus,
          lastLogin: student.lastLogin,
          consultant: student.consultant,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
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

    const student = await Student.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: hashedOTP,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    student.isEmailVerified = true;
    student.emailVerificationToken = undefined;
    student.emailVerificationExpire = undefined;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify phone with OTP
// @route   POST /api/auth/verify-phone
// @access  Public
exports.verifyPhone = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    // Find student
    const student = await Student.findOne({ phoneNumber });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if phone verification is still valid
    if (
      student.phoneVerificationExpire &&
      student.phoneVerificationExpire < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP (this handles dev mode automatically)
    const isValid = await verifySMSOTP(phoneNumber, otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    student.isPhoneVerified = true;
    student.phoneVerificationExpire = undefined;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend email verification OTP
// @route   POST /api/auth/resend-email-otp
// @access  Public
exports.resendEmailOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    // Generate new OTP
    const otp = student.generateOTP();
    student.emailVerificationToken = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    student.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await student.save();

    // Send OTP (handles dev/prod automatically)
    await sendOTPEmail(student.email, otp, "email");

    res.status(200).json({
      success: true,
      message: isDevelopment
        ? `Email verification OTP: ${otp} (check console in dev mode)`
        : "Verification OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend phone verification OTP
// @route   POST /api/auth/resend-phone-otp
// @access  Public
exports.resendPhoneOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const student = await Student.findOne({ phoneNumber });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number already verified",
      });
    }

    // Send new SMS OTP (handles dev/prod automatically)
    await sendSMSOTP(phoneNumber);
    student.phoneVerificationExpire = Date.now() + 10 * 60 * 1000;
    await student.save();

    res.status(200).json({
      success: true,
      message: isDevelopment
        ? "SMS OTP sent (check console in dev mode)"
        : "SMS OTP sent successfully",
    });
  } catch (error) {
    console.error("SMS resend failed:", error);
    next(error);
  }
};

// @desc    Forgot Password - Send OTP to email
// @route   POST /api/auth/forgot-password
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

    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student found with this email",
      });
    }

    // Generate 6-digit OTP
    const otp = student.generateOTP();

    // Hash OTP and store
    student.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    student.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await student.save();

    // Send OTP via email (handles dev/prod automatically)
    try {
      await sendPasswordResetOTPEmail(student.email, otp);

      res.status(200).json({
        success: true,
        message: isDevelopment
          ? `Password reset OTP: ${otp} (check console in dev mode)`
          : "Password reset OTP sent to your email",
      });
    } catch (error) {
      student.passwordResetOTP = undefined;
      student.passwordResetOTPExpire = undefined;
      await student.save();

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
// @route   POST /api/auth/reset-password
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

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash the provided OTP
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    // Find student with matching OTP and not expired
    const student = await Student.findOne({
      email: email.toLowerCase(),
      passwordResetOTP: hashedOTP,
      passwordResetOTPExpire: { $gt: Date.now() },
    }).select("+passwordResetOTP +passwordResetOTPExpire");

    if (!student) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update password
    student.password = newPassword;
    student.passwordResetOTP = undefined;
    student.passwordResetOTPExpire = undefined;
    await student.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend Password Reset OTP
// @route   POST /api/auth/resend-reset-otp
// @access  Public
exports.resendResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student found with this email",
      });
    }

    // Generate new OTP
    const otp = student.generateOTP();
    student.passwordResetOTP = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    student.passwordResetOTPExpire = Date.now() + 10 * 60 * 1000;
    await student.save();

    // Send OTP
    await sendPasswordResetOTPEmail(student.email, otp);

    res.status(200).json({
      success: true,
      message: isDevelopment
        ? `OTP resent: ${otp} (check console in dev mode)`
        : "OTP resent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current student profile
// @route   GET /api/auth/me
// @access  Private (Student only)
exports.getMe = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user.id)
      .select("-password")
      .populate(
        "consultant",
        "firstName lastName companyName email phoneNumber"
      )
      .populate("academicRecords")
      .populate("testScores")
      .populate("workExperience")
      .populate("coBorrowers")
      .populate("admissionLetters");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};
