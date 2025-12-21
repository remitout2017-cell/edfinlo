// utils/phoneVerification.js
const nodemailer = require("nodemailer");
const axios = require("axios");
const config = require("../config/config");

let transporter = null;
const isDevelopment = config.env === "development";

// Lazily create and reuse Nodemailer transporter
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: config.email.service || "gmail",
      host: config.email.host || "smtp.gmail.com",
      port: Number(config.email.port) || 587,
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }
  return transporter;
};

/**
 * Send OTP email (used for registration / email verification).
 */
exports.sendOTPEmail = async (email, otp, type = "email") => {
  const subject =
    type === "phone" ? "Phone Verification OTP" : "Email Verification OTP";
  const html = `
Your OTP is:

**${otp}**

This OTP is valid for 10 minutes.
`;

  try {
    if (isDevelopment) {
      console.log(`📧 [DEV] ${subject} for ${email} -> OTP: ${otp}`);
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject,
      html,
    };

    await getTransporter().sendMail(mailOptions);
  } catch (err) {
    console.error("sendOTPEmail error:", err.message);
    throw new Error("Failed to send OTP email");
  }
};

exports.sendStudentInviteEmail = async (
  email,
  inviteLink,
  consultantName,
  companyName
) => {
  const subject = "Invitation to Join Student Loan Platform";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">You've Been Invited!</h2>
      <p>Hello,</p>
      <p><strong>${consultantName}</strong>${
    companyName ? ` from <strong>${companyName}</strong>` : ""
  } has invited you to create an account on our Student Loan Platform.</p>
      <p>Click the button below to register and get started:</p>
      <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Accept Invitation</a>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 12px; word-break: break-all;">${inviteLink}</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">This invitation will expire in 7 days.</p>
      <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  `;

  try {
    if (isDevelopment) {
      console.log(`📧 [DEV] Student Invitation Email for ${email}`);
      console.log(
        `From: ${consultantName}${companyName ? ` (${companyName})` : ""}`
      );
      console.log(`Invite Link: ${inviteLink}`);
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject,
      html,
    };

    await getTransporter().sendMail(mailOptions);
  } catch (err) {
    console.error("sendStudentInviteEmail error:", err.message);
    throw new Error("Failed to send invitation email");
  }
};

/**
 * Send password reset OTP email
 */
exports.sendPasswordResetOTPEmail = async (email, otp) => {
  const subject = "Password Reset OTP";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You have requested to reset your password.</p>
      <p>Your OTP is:</p>
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #666;">This OTP is valid for 10 minutes.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this, please ignore this email or contact support if you're concerned.</p>
    </div>
  `;

  try {
    if (isDevelopment) {
      console.log(`📧 [DEV] Password Reset OTP for ${email} -> OTP: ${otp}`);
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject,
      html,
    };

    await getTransporter().sendMail(mailOptions);
  } catch (err) {
    console.error("sendPasswordResetOTPEmail error:", err.message);
    throw new Error("Failed to send password reset OTP email");
  }
};

/**
 * Send password-reset email with link.
 */
exports.sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = "Password Reset Request";
  const html = `
Click the link below to reset your password:

${resetUrl}

If you did not request this, you can ignore this email.
`;

  try {
    if (isDevelopment) {
      console.log(
        `📧 [DEV] Password reset email for ${email} -> URL: ${resetUrl}`
      );
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject,
      html,
    };

    await getTransporter().sendMail(mailOptions);
  } catch (err) {
    console.error("sendPasswordResetEmail error:", err.message);
    throw new Error("Failed to send password reset email");
  }
};

/**
 * Send SMS OTP via OTP.dev.
 */
exports.sendSMSOTP = async (phone) => {
  try {
    if (isDevelopment) {
      const fake = {
        message: "DEV MODE: SMS OTP not sent to real service",
        phone,
      };
      console.log("📱 [DEV] sendSMSOTP:", fake);
      return fake;
    }
    const response = await axios.post(
      "https://api.otp.dev/v1/verifications",
      {
        data: {
          channel: "sms",
          sender: config.otpDev.senderId,
          phone,
          template: config.otpDev.templateId,
          code_length: parseInt(config.otpDev.codeLength || "4", 10),
        },
      },
      {
        headers: {
          "X-OTP-Key": config.otpDev.apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error("sendSMSOTP error:", err.response?.data || err.message);
    throw new Error("Failed to send SMS OTP");
  }
};

/**
 * Verify SMS OTP via OTP.dev.
 */
exports.verifySMSOTP = async (phone, otp) => {
  try {
    if (isDevelopment) {
      console.log("📱 [DEV] verifySMSOTP:", { phone, otp, valid: true });
      return true;
    }
    const response = await axios.get("https://api.otp.dev/v1/verifications", {
      params: { code: otp, phone },
      headers: {
        "X-OTP-Key": config.otpDev.apiKey,
        accept: "application/json",
      },
    });

    const data = response.data;
    const isValid =
      (Array.isArray(data) && data.length > 0) ||
      (!!data && Object.keys(data).length > 0);

    return isValid;
  } catch (err) {
    console.error("verifySMSOTP error:", err.response?.data || err.message);
    throw new Error("Failed to verify SMS OTP");
  }
};
