// controllers/consultantController.js
const crypto = require("crypto");
const Consultant = require("../models/Consultant");
const Student = require("../models/students");
const AcademicRecords = require("../models/AcademicRecords");
const WorkExperience = require("../models/Workexperience");
const CoBorrower = require("../models/CoBorrower");
const AdmissionLetter = require("../models/AdmissionLetter");
const generateToken = require("../utils/generateToken");
const config = require("../config/config");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");
const cache = require("../utils/cache");
const nodemailer = require("nodemailer");
const Invite = require("../models/Invite"); // ✅ Add this import
const User = require("../models/students");

let emailTransporter = null;
const getEmailTransporter = () => {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
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
  return emailTransporter;
};

// Add these methods to consultantController.js

exports.getDashboardStats = async (req, res, next) => {
  try {
    const consultantId = req.user.id;

    const totalStudents = await User.countDocuments({ consultantId });
    const kycComplete = await User.countDocuments({
      consultantId,
      "kycData.isVerified": true,
    });
    const loanRequests = await LoanRequest.countDocuments({ consultantId });
    const admissions = await AdmissionLetter.countDocuments({ consultantId });

    res.json({
      success: true,
      stats: {
        totalStudents,
        kycComplete,
        loanRequests,
        admissions,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getInvites = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const consultantId = req.user.id;

    // Create Invite model if doesn't exist
    const invites = await Invite.find({ consultantId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Invite.countDocuments({ consultantId });

    res.json({
      success: true,
      invites,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.resendInvite = async (req, res, next) => {
  try {
    const invite = await Invite.findById(req.params.id);

    if (!invite || invite.consultantId.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    // Resend email logic here
    await sendInviteEmail(invite.email, invite.token);

    invite.lastSent = Date.now();
    await invite.save();

    res.json({ success: true, message: "Invite resent successfully" });
  } catch (err) {
    next(err);
  }
};

exports.cancelInvite = async (req, res, next) => {
  try {
    const invite = await Invite.findOneAndDelete({
      _id: req.params.id,
      consultantId: req.user.id,
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    res.json({ success: true, message: "Invite cancelled" });
  } catch (err) {
    next(err);
  }
};

exports.getLoanRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const consultantId = req.user.id;

    const query = { consultantId };
    if (status) query.status = status;

    const requests = await LoanRequest.find(query)
      .populate("studentId", "firstName lastName email")
      .populate("nbfcId", "companyName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await LoanRequest.countDocuments(query);

    res.json({
      success: true,
      requests,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getLoanRequestById = async (req, res, next) => {
  try {
    const request = await LoanRequest.findOne({
      _id: req.params.id,
      consultantId: req.user.id,
    })
      .populate("studentId")
      .populate("nbfcId");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Loan request not found",
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

exports.getStudentLoanRequests = async (req, res, next) => {
  try {
    const requests = await LoanRequest.find({
      studentId: req.params.id,
      consultantId: req.user.id,
    }).populate("nbfcId", "companyName");

    res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

exports.getAdmissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const consultantId = req.user.id;

    const query = { consultantId };
    if (status) query.status = status;

    const admissions = await AdmissionLetter.find(query)
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AdmissionLetter.countDocuments(query);

    res.json({
      success: true,
      admissions,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdmissionById = async (req, res, next) => {
  try {
    const admission = await AdmissionLetter.findOne({
      _id: req.params.id,
      consultantId: req.user.id,
    }).populate("studentId");

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: "Admission not found",
      });
    }

    res.json({ success: true, admission });
  } catch (err) {
    next(err);
  }
};

exports.getStudentAdmissions = async (req, res, next) => {
  try {
    const admissions = await AdmissionLetter.find({
      studentId: req.params.id,
      consultantId: req.user.id,
    });

    res.json({ success: true, admissions });
  } catch (err) {
    next(err);
  }
};

exports.getLoanAnalyses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const consultantId = req.user.id;

    const analyses = await LoanAnalysisHistory.find({ consultantId })
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await LoanAnalysisHistory.countDocuments({ consultantId });

    res.json({
      success: true,
      analyses,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getStudentAnalysisHistory = async (req, res, next) => {
  try {
    const analyses = await LoanAnalysisHistory.find({
      studentId: req.params.id,
      consultantId: req.user.id,
    }).sort({ createdAt: -1 });

    res.json({ success: true, analyses });
  } catch (err) {
    next(err);
  }
};

exports.exportStudents = async (req, res, next) => {
  try {
    const students = await User.find({ consultantId: req.user.id })
      .select("firstName lastName email phoneNumber kycData academicRecords")
      .lean();

    // Convert to CSV or Excel format
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=students.csv");

    const csv = convertToCSV(students);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

exports.exportLoanRequests = async (req, res, next) => {
  try {
    const requests = await LoanRequest.find({ consultantId: req.user.id })
      .populate("studentId", "firstName lastName email")
      .populate("nbfcId", "companyName")
      .lean();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=loan-requests.csv"
    );

    const csv = convertToCSV(requests);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// Helper function
function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) => Object.values(row).join(","));

  return [headers, ...rows].join("\n");
}

/**
 * Simple email sender placeholder for invites.
 * Replace with your real email service (e.g., Nodemailer, SES, SendGrid).
 */
async function sendConsultantInviteEmail(email, registrationLink) {
  const isDevelopment = config.env === "development";

  const subject = "You have been invited to register";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Student Registration Invitation</h2>
      <p>You have been invited by a consultant to register on our platform.</p>
      <p>Click the link below to complete your registration:</p>
      <p>
        <a href="${registrationLink}" 
           style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Complete Registration
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${registrationLink}</p>
      <p><small>This invitation link is valid for 7 days.</small></p>
    </div>
  `;

  try {
    // In development, just log
    if (isDevelopment) {
      console.log(`📧 [DEV] Consultant invite email for ${email}`);
      console.log(`Registration Link: ${registrationLink}`);
      return;
    }

    // In production, send real email
    const mailOptions = {
      from: config.email.from || config.email.user,
      to: email,
      subject,
      html,
    };

    await getEmailTransporter().sendMail(mailOptions);
    console.log(`✅ Invite email sent to ${email}`);
  } catch (err) {
    console.error("sendConsultantInviteEmail error:", err.message);
    throw new Error(`Failed to send invite email to ${email}`);
  }
}

/**
 * @desc Consultant login
 * @route POST /api/consultant/login
 * @access Public
 */
exports.loginConsultant = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });
  }

  const consultant = await Consultant.findOne({ email }).select("+password");

  if (!consultant || !(await consultant.comparePassword(password))) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid credentials" });
  }

  if (!consultant.isActive) {
    return res
      .status(403)
      .json({ success: false, message: "Account deactivated" });
  }

  consultant.lastLogin = Date.now();
  await consultant.save();

  const token = generateToken(consultant.id, consultant.role);
  const { password: _, ...data } = consultant.toObject();

  res.json({
    success: true,
    message: "Login successful",
    token,
    consultant: data,
  });
});

/**
 * @desc Invite students (single or bulk, max 30)
 * @route POST /api/consultant/invite-students
 * @access Private - Consultant only
 * body: { emails: string | string[] }
 */
exports.inviteStudents = async (req, res, next) => {
  try {
    const { emails } = req.body;
    const consultantId = req.user.id;

    // ✅ DEVELOPMENT: Log consultant details
    if (process.env.NODE_ENV === "development") {
      const consultant = await Consultant.findById(consultantId).lean();
      console.log("🧑‍💼 CONSULTANT INVITING:", {
        consultantId,
        consultantName: consultant?.name,
        consultantEmail: consultant?.email,
        invitingEmails: emails,
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Emails array is required and cannot be empty",
      });
    }

    const results = {
      created: 0,
      skipped: { invites: 0, users: 0 },
      errors: [],
    };
    const invites = [];

    for (const email of emails) {
      const cleanEmail = email.toLowerCase().trim();

      try {
        // ✅ STEP 1: Check if user already exists
        const existingUser = await User.findOne({
          email: cleanEmail,
        }).lean();

        if (existingUser) {
          invites.push({
            email: cleanEmail,
            status: "registered",
            message: `User already registered (ID: ${existingUser._id})`,
            userRole: existingUser.role,
            createdAt: existingUser.createdAt,
          });
          results.skipped.users++;

          // ✅ DEVELOPMENT: Log duplicate user
          console.log("👤 DUPLICATE USER FOUND:", cleanEmail, existingUser._id);
          continue;
        }

        // ✅ STEP 2: Check if already invited
        const existingInvite = await Invite.findOne({
          consultantId,
          email: cleanEmail,
          status: { $in: ["pending", "accepted"] },
        }).lean();

        if (existingInvite) {
          invites.push({
            email: cleanEmail,
            status: existingInvite.status,
            message: "Already invited",
            token: existingInvite.token,
            expiresAt: existingInvite.expiresAt,
          });
          results.skipped.invites++;

          // ✅ DEVELOPMENT: Log existing invite
          console.log("📧 EXISTING INVITE:", cleanEmail, existingInvite.token);
          continue;
        }

        // ✅ STEP 3: Create new invite
        const invite = new Invite({
          consultantId,
          email: cleanEmail,
        });

        await invite.save();

        // ✅ STEP 4: Generate invite URL (Environment-aware)
        const frontendUrl =
          process.env.FRONTEND_URL ||
          (process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : "https://yourdomain.com");

        const inviteLink = `${frontendUrl}/register/invite?email=${encodeURIComponent(
          invite.email
        )}&token=${invite.token}`;

        invites.push({
          email: invite.email,
          token: invite.token,
          inviteLink,
          expiresAt: invite.expiresAt,
          frontendUrl,
        });

        results.created++;

        // ✅ DEVELOPMENT: Log new invite with URL
        console.log("✅ NEW INVITE CREATED:", {
          email: invite.email,
          token: invite.token.substring(0, 8) + "...",
          inviteUrl: inviteLink,
          expiresAt: invite.expiresAt,
        });
      } catch (error) {
        console.error("❌ INVITE ERROR:", cleanEmail, error.message);
        results.errors.push({
          email: cleanEmail,
          error: error.message,
        });
      }
    }

    // ✅ DEVELOPMENT: Summary log
    if (process.env.NODE_ENV === "development") {
      console.log("📊 INVITE SUMMARY:", {
        consultantId,
        total: emails.length,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors.length,
      });
    }

    res.status(201).json({
      success: true,
      message: `${results.created} new invite(s) created successfully`,
      details: results,
      invites,
    });
  } catch (error) {
    console.error("🚨 CONSULTANT INVITE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create invites",
      error:
        process.env.NODE_ENV === "development" ? error.message : "Server error",
    });
  }
};
/**
 * @desc Get students belonging to logged-in consultant
 * @route GET /api/consultant/students
 * @access Private - Consultant only
 */
exports.getMyStudents = asyncHandler(async (req, res, next) => {
  const consultantId = req.user.id;
  const { search = "", kycStatus = "", page = 1, limit = 20 } = req.query;

  const cacheKey = `consultant:students:${consultantId}:${page}:${limit}:${search}:${kycStatus}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({ success: true, ...cached, fromCache: true });
  }

  const query = { consultant: consultantId };
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (kycStatus) query.kycStatus = kycStatus;

  const students = await Student.find(query)
    .select(
      "firstName lastName email phoneNumber kycStatus createdAt lastLogin"
    )
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .sort({ createdAt: -1 })
    .lean();

  const count = await Student.countDocuments(query);

  const payload = {
    count: students.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: Number(page),
    data: students,
  };

  await cache.set(cacheKey, payload, 60); // 1 minute cache

  res.status(200).json({ success: true, ...payload, fromCache: false });
});

/**
 * Helper: ensure a student belongs to this consultant
 */
async function ensureStudentBelongsToConsultant(studentId, consultantId) {
  const student = await Student.findById(studentId)
    .select(
      "firstName lastName email phoneNumber profilePicture kycStatus kycVerifiedAt isEmailVerified isPhoneVerified isActive createdAt lastLogin consultant"
    )
    .lean();

  if (!student) {
    throw new AppError("Student not found", 404);
  }

  if (student.consultant?.toString() !== consultantId.toString()) {
    throw new AppError("You do not have access to this student", 403);
  }

  return student;
}

/**
 * @desc Register new consultant
 * @route POST /api/consultant/register
 * @access Public (or Admin-only if you want)
 */
exports.registerConsultant = asyncHandler(async (req, res, next) => {
  const { name, email, password, phoneNumber } = req.body;

  // Check if consultant already exists
  const existingConsultant = await Consultant.findOne({ email });
  if (existingConsultant) {
    return res.status(400).json({
      success: false,
      message: "Email already registered",
    });
  }

  // Create consultant
  const consultant = await Consultant.create({
    name,
    email,
    password,
    phoneNumber,
    isEmailVerified: true, // Auto-verified for consultants
    isPhoneVerified: true,
  });

  // Generate token
  const token = generateToken(consultant.id, consultant.role);

  res.status(201).json({
    success: true,
    message: "Consultant registered successfully",
    token,
    consultant: {
      id: consultant._id,
      name: consultant.name,
      email: consultant.email,
      phoneNumber: consultant.phoneNumber,
      role: consultant.role,
    },
  });
});

/**
 * @desc Get student profile (for this consultant)
 * @route GET /api/consultant/students/:id
 * @access Private - Consultant only
 */
exports.getStudentProfile = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const consultantId = req.user.id;
  const cacheKey = `consultant:studentProfile:${consultantId}:${id}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json({ success: true, data: cached, fromCache: true });
  }

  const student = await ensureStudentBelongsToConsultant(id, consultantId);
  await cache.set(cacheKey, student, 120); // 2 minutes

  res.status(200).json({ success: true, data: student, fromCache: false });
});

exports.getStudentSummary = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const consultantId = req.user.id;
  const cacheKey = `consultant:studentSummary:${consultantId}:${id}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json({ success: true, data: cached, fromCache: true });
  }

  const student = await ensureStudentBelongsToConsultant(id, consultantId);
  const academicRecords = await AcademicRecords.findOne({ user: id })
    .select(
      "-__v -class10.marksheets.extractedData -class12.marksheets.extractedData"
    )
    .lean();
  const workExperience = await WorkExperience.find({ user: id })
    .select("-extractedData")
    .lean();
  const coBorrowers = await CoBorrower.find({ student: id })
    .select(
      "firstName lastName relationToStudent email phoneNumber kycStatus financialVerificationStatus"
    )
    .lean();
  const admissionLetters = await AdmissionLetter.find({ user: id })
    .select("-extractedFields")
    .lean();

  const summary = {
    student,
    academicRecords,
    workExperience,
    coBorrowers,
    admissionLetters,
  };

  await cache.set(cacheKey, summary, 120);

  res.status(200).json({ success: true, data: summary, fromCache: false });
});

/**
 * @desc Get student summary (non-sensitive data) for this consultant
 * @route GET /api/consultant/students/:id/summary
 * @access Private - Consultant only
 */
exports.getStudentSummary = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const consultantId = req.user.id;

  const student = await ensureStudentBelongsToConsultant(id, consultantId);

  const academicRecords = await AcademicRecords.findOne({ user: id })
    .select(
      "-__v -class10.marksheets.extractedData -class12.marksheets.extractedData"
    )
    .lean();

  const workExperience = await WorkExperience.find({ user: id })
    .select("-extractedData")
    .lean();

  const coBorrowers = await CoBorrower.find({ student: id })
    .select(
      "firstName lastName relationToStudent email phoneNumber kycStatus financialVerificationStatus"
    )
    .lean();

  const admissionLetters = await AdmissionLetter.find({ user: id })
    .select("-extractedFields")
    .lean();

  res.status(200).json({
    success: true,
    data: {
      student,
      academicRecords,
      workExperience,
      coBorrowers,
      admissionLetters,
    },
  });
});
