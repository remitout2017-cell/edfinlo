// models/Admin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { 
      type: String,
      enum: ["superadmin", "subadmin"],
      default: "subadmin",
      index: true,
    },
    permissions: {
      type: [String], // e.g. ['nbfcs:read','nbfcs:approve','students:create','students:delete']
      default: [],
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

AdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

AdminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

AdminSchema.methods.generateVerificationToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

module.exports = mongoose.model("Admin", AdminSchema);
