// models/Consultant.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const invitedStudentSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    accepted: { type: Boolean, default: false },
  },
  { _id: false }
);

const ConsultantSchema = new mongoose.Schema(
  {
    role: { type: String, default: "consultant" },
    name: { type: String, trim: true },
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
      trim: true,
    },

    role: {
      type: String,
      enum: ["consultant"],
      default: "consultant",
    },

    // Reuse same flags as Student/Admin so authMiddleware checks still work
    isEmailVerified: { type: Boolean, default: true },
    isPhoneVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    lastLogin: Date,

    // For password reset if you want later
    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },

    // Optional: maintain a list of students and invites
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],

    invitedStudents: [invitedStudentSchema],
  },
  { timestamps: true }
);

// Hash password before save
ConsultantSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
ConsultantSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generic token generator (for invites / reset)
ConsultantSchema.methods.generateVerificationToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

module.exports = mongoose.model("Consultant", ConsultantSchema);
