// models/consultant/Consultant.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const invitedStudentSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    accepted: { type: Boolean, default: false },
    sentAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
  },
  { _id: false }
);

const ConsultantSchema = new mongoose.Schema(
  {
    role: { type: String, default: "consultant", immutable: true },
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    companyName: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // OTP fields for password reset
    passwordResetOTP: { type: String, select: false },
    passwordResetOTPExpire: { type: Date, select: false },

    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    // Students managed by this consultant
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],

    // Invitation tracking
    invitedStudents: [invitedStudentSchema],

    // Statistics
    stats: {
      totalStudents: { type: Number, default: 0 },
      activeStudents: { type: Number, default: 0 },
      completedProfiles: { type: Number, default: 0 },
      pendingInvites: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Indexes
ConsultantSchema.index({ email: 1 });
ConsultantSchema.index({ phoneNumber: 1 });
ConsultantSchema.index({ isActive: 1 });
ConsultantSchema.index({ "invitedStudents.email": 1 });

// Hash password before save
ConsultantSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
ConsultantSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
ConsultantSchema.methods.generateOTP = function () {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate verification token
ConsultantSchema.methods.generateVerificationToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

module.exports = mongoose.model("Consultant", ConsultantSchema);
