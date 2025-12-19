const User = require("../../models/student/students");
const crypto = require("crypto");
const generateToken = require("../../utils/generateToken");
const {
  sendOTPEmail,
  sendSMSOTP,
  verifySMSOTP,
  sendPasswordResetEmail,
} = require("../../utils/phoneVerification");
const config = require("../../config/config");
const Admin = require("../../models/admin/Admin");
const nbfc = require("../../models/nbfc/NBFC");
const isDevelopment = config.env === "development";
const Consultant = require("../../models/consultant/Consultant");
const Invite = require("../../models/consultant/Invite");
//adding rate limiting
exports.registerFromInvite = async (req, res, next) => {
  try {
    const { token, email, firstName, lastName, password, phoneNumber } =
      req.body;

    if (!token || !email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: "Token, email, firstName, lastName, and password are required",
      });
    }

    // Find and validate invite
    const invite = await Invite.findOne({
      token,
      email: email.toLowerCase(),
      status: "pending",
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invite token",
      });
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      return res.status(400).json({
        success: false,
        message: "Invite token has expired",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      firstName,
      lastName,
      password,
      phoneNumber,
      consultantId: invite.consultantId,
      isEmailVerified: false, // Require verification
      isPhoneVerified: phoneNumber ? false : true,
      role: "student",
    });

    // Mark invite as accepted
    invite.status = "accepted";
    await invite.save();

    // Generate login token
    const tokenResponse = await generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please verify your email.",
      data: {
        token: tokenResponse.token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Register from invite error:", error);
    next(error);
  }
};
//adding rate limiting
exports.register = async (req, res, next) => {
  try {
    const {
      firstname,
      lastname,
      password,
      email,
      phoneNumber,
      inviteToken,
      role,
    } = req.body;
    if (!firstname || !lastname || !password || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Name, password, phone number, and role are required",
      });
    }

    // Try to derive first/last from "name" if firstName/lastName not provided
    let fName = firstname;
    let lName = lastname;
    if ((!fName || !lName) && firstname) {
      const parts = String(firstname).trim().split(/\s+/);
      fName = fName || parts[0];
      lName = lName || parts.slice(1).join(" ") || "";
    }

    let existingUser;
    existingUser = await User.findOne({
      $or: [{ phoneNumber }, { email: email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this phone number or email already exists",
      });
    }
    let consultantId = null;
    // If inviteToken provided, validate and link to consultant
    if (inviteToken) {
      const consultant = await Consultant.findOne({
        "invitedStudents.token": inviteToken,
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
        (inv) => inv.token === inviteToken && inv.email === email.toLowerCase()
      );

      // Check if email already added to consultant's students
      const emailExists = consultant.invitedStudents.some(
        (inv) => inv.email === email.toLowerCase() && inv.accepted
      );

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already registered with this consultant",
        });
      }

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

      consultantId = consultant._id;

      // Mark invite as accepted
      invite.accepted = true;
      await consultant.save();
    }

    const user = new User({
      email,
      password,
      phoneNumber,
      firstName: firstname,
      lastName: lastname,
      consultant: consultantId, // Link to consultant if invited
      isEmailVerified: isDevelopment,
      isPhoneVerified: isDevelopment,
    });
    await user.save();

    // // Try sending email OTP
    // try {
    //   await sendOTPEmail(email, emailOTP, "email");
    // } catch (err) {
    //   return res.status(500).json({
    //     success: false,
    //     message: "Failed to send email OTP. User not registered.",
    //   });
    // }

    // // Try sending SMS OTP if phone provided
    // if (phoneNumber) {
    //   try {
    //     await sendSMSOTP(phoneNumber);
    //   } catch (err) {
    //     return res.status(500).json({
    //       success: false,
    //       message: "Failed to send SMS OTP. User not registered.",
    //     });
    //   }
    // }
    // await user.save();

    // Add student to consultant's students array if invited
    if (consultantId) {
      await Consultant.findByIdAndUpdate(consultantId, {
        $addToSet: { students: user._id },
      });
    }

    // // Generate and set email OTP/token
    // const emailOTP = user.generateOTP();
    // user.emailVerificationToken = crypto
    //   .createHash("sha256")
    //   .update(emailOTP)
    //   .digest("hex");
    // user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    // user.phoneVerificationExpire = Date.now() + 10 * 60 * 1000;

    // await user.save();

    res.status(201).json({
      success: true,
      message: "User registered. OTPs sent to email and phone (if provided).",
      linkedToConsultant: !!consultantId,
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({
      email,
      emailVerificationToken: hashedOTP,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Email verified." });
  } catch (error) {
    next(error);
  }
};

exports.verifyPhone = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;
    const isValid = await verifySMSOTP(phoneNumber, otp);

    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    user.isPhoneVerified = true;
    await user.save();

    res.json({ success: true, message: "Phone number verified." });
  } catch (error) {
    next(error);
  }
};
//ading rate limiting

// Ensure OTP resend invalidates previous OTP and respects expiry
exports.resendEmailVerification = async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });
  if (user.isEmailVerified)
    return res
      .status(400)
      .json({ success: false, message: "Email already verified" });

  const emailOTP = user.generateOTP();
  user.emailVerificationToken = crypto
    .createHash("sha256")
    .update(emailOTP)
    .digest("hex");
  user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 min expiry
  await user.save();

  if (!config.isDevelopment)
    await sendOTPEmail(user.email, emailOTP, "email").catch(console.error);
  else console.log("DEV New Email OTP", emailOTP);

  res
    .status(200)
    .json({ success: true, message: "Email OTP sent successfully" });
};

// Login: Handle both missing user and password mismatch
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user.id, user.role);
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};
//adding rate limiting
exports.resendPhoneOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number required",
      });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone already verified",
      });
    }

    // Send new SMS OTP via OTP.dev
    try {
      const smsResult = await sendSMSOTP(phoneNumber);
      const messageId =
        smsResult.message_id || smsResult.id || smsResult.data?.id || null;

      if (!messageId) {
        throw new Error("Failed to get SMS message ID from OTP service");
      }

      user.phoneVerificationMessageId = messageId;
      user.phoneVerificationExpire = Date.now() + 10 * 60 * 1000;
      await user.save();

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
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = user.generateVerificationToken();
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpire = Date.now() + 60 * 60 * 1000;
    await user.save();

    const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;
    sendPasswordResetEmail(user.email, resetUrl).catch(console.error);

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    next(error);
  }
};

// @access Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password required",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};
