// utils/phoneVerification.js
const nodemailer = require('nodemailer');
const axios = require('axios');
const config = require('../config/config');

let transporter = null;
const isDevelopment = config.env === 'development';

// Lazily create and reuse Nodemailer transporter
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: config.email.service || 'gmail',
      host: config.email.host || 'smtp.gmail.com',
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
exports.sendOTPEmail = async (email, otp, type = 'email') => {
  const subject = type === 'phone' ? 'Phone Verification OTP' : 'Email Verification OTP';
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
    console.error('sendOTPEmail error:', err.message);
    throw new Error('Failed to send OTP email');
  }
};

/**
 * Send password-reset email with link.
 */
exports.sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = 'Password Reset Request';
  const html = `
Click the link below to reset your password:

${resetUrl}

If you did not request this, you can ignore this email.
`;

  try {
    if (isDevelopment) {
      console.log(`📧 [DEV] Password reset email for ${email} -> URL: ${resetUrl}`);
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
    console.error('sendPasswordResetEmail error:', err.message);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send SMS OTP via OTP.dev.
 */
exports.sendSMSOTP = async (phone) => {
  try {
    if (isDevelopment) {
      const fake = { message: 'DEV MODE: SMS OTP not sent to real service', phone };
      console.log('📱 [DEV] sendSMSOTP:', fake);
      return fake;
    }
    const response = await axios.post(
      'https://api.otp.dev/v1/verifications',
      {
        data: {
          channel: 'sms',
          sender: config.otpDev.senderId,
          phone,
          template: config.otpDev.templateId,
          code_length: parseInt(config.otpDev.codeLength || '4', 10),
        },
      },
      {
        headers: {
          'X-OTP-Key': config.otpDev.apiKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error('sendSMSOTP error:', err.response?.data || err.message);
    throw new Error('Failed to send SMS OTP');
  }
};

/**
 * Verify SMS OTP via OTP.dev.
 */
exports.verifySMSOTP = async (phone, otp) => {
  try {
    if (isDevelopment) {
      console.log('📱 [DEV] verifySMSOTP:', { phone, otp, valid: true });
      return true;
    }
    const response = await axios.get('https://api.otp.dev/v1/verifications', {
      params: { code: otp, phone },
      headers: {
        'X-OTP-Key': config.otpDev.apiKey,
        accept: 'application/json',
      },
    });

    const data = response.data;
    const isValid =
      (Array.isArray(data) && data.length > 0) ||
      (!!data && Object.keys(data).length > 0);

    return isValid;
  } catch (err) {
    console.error('verifySMSOTP error:', err.response?.data || err.message);
    throw new Error('Failed to verify SMS OTP');
  }
};
