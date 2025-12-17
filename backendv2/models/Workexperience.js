// models/Workexperience.js
const mongoose = require("mongoose");

// ✅ Universal Employment Type - Supports all work arrangements
const employmentTypeEnum = [
  "full_time",
  "part_time",
  "internship_paid",
  "internship_unpaid",
  "freelance",
  "contract",
  "temporary",
  "volunteer",
  "apprenticeship",
  "self_employed",
  "other",
];

// Salary slip schema (optional - may not exist for unpaid work)
const salarySlipSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      enum: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      required: true, // Added required
    },
    year: {
      type: Number,
      min: 2000,
      max: () => new Date().getFullYear() + 1,
      required: true, // Added required
    },
    documentUrl: {
      type: String,
      required: true,
    },
    aiExtractedSalary: {
      type: Number,
      min: 0,
      default: null,
    },
    extractionConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5, // Added default
    },
    extractedAt: {
      type: Date,
      default: Date.now, // Added default
    },
    extractionStatus: {
      type: String,
      enum: ["pending", "success", "failed", "manual_review"],
      default: "pending",
    },
  },
  { _id: true }
);

const workExperienceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // ✅ Basic Information
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    employmentType: {
      type: String,
      enum: employmentTypeEnum,
      default: "full_time",
    },

    // ✅ Dates
    startDate: {
      type: Date,
      required: true, // Made required for consistency
    },
    endDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (endDate) {
          if (!endDate || !this.startDate) return true;
          return endDate >= this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    currentlyWorking: {
      type: Boolean,
      default: false,
    },

    // ✅ Experience Duration
    monthsWorked: {
      type: Number,
      min: 0,
      default: 0, // Added default
    },

    // ✅ Compensation (Optional - for unpaid internships)
    isPaid: {
      type: Boolean,
      default: true,
    },
    stipendAmount: {
      type: Number,
      min: 0,
      default: null,
    },

    // ✅ Documents (Only experience letter mandatory)
    experienceLetterUrl: {
      type: String,
      required: true, // Made required as it's mandatory
    },
    offerLetterUrl: {
      type: String,
      default: null,
    },
    joiningLetterUrl: {
      type: String,
      default: null,
    },
    employeeIdCardUrl: {
      type: String,
      default: null,
    },
    salarySlips: {
      type: [salarySlipSchema],
      default: [], // Added default
    },

    // ✅ Verification
    verified: {
      type: Boolean,
      default: false,
    },
    verificationNotes: {
      type: String,
      default: null,
    },
    verificationConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5, // Added default
    },

    // ✅ AI Metadata
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      select: false, // Don't return in queries
    },
    extractionStatus: {
      type: String,
      enum: ["pending", "success", "failed", "manual_review"],
      default: "pending",
    },
    extractedAt: {
      type: Date,
      default: Date.now, // Added default
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Added to include virtuals in JSON
    toObject: { virtuals: true }, // Added to include virtuals in objects
  }
);

// Indexes
workExperienceSchema.index({ user: 1, createdAt: -1 });
workExperienceSchema.index({ verified: 1 });
workExperienceSchema.index({ employmentType: 1 });
workExperienceSchema.index({ startDate: -1 });
workExperienceSchema.index({ companyName: "text", jobTitle: "text" });

// Virtual for total experience in years
workExperienceSchema.virtual("experienceYears").get(function () {
  if (!this.monthsWorked) return 0;
  return Math.round((this.monthsWorked / 12) * 100) / 100;
});

// Method to calculate months worked
workExperienceSchema.methods.calculateMonthsWorked = function () {
  if (!this.startDate) {
    this.monthsWorked = 0;
    return 0;
  }

  const end =
    this.currentlyWorking || !this.endDate ? new Date() : this.endDate;
  const start = this.startDate;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  this.monthsWorked = Math.max(0, Math.round(months));
  return this.monthsWorked;
};

workExperienceSchema.pre("save", async function () {
  if (
    this.isNew ||
    this.isModified("startDate") ||
    this.isModified("endDate") ||
    this.isModified("currentlyWorking")
  ) {
    this.calculateMonthsWorked();
  }
});

module.exports = mongoose.model("WorkExperience", workExperienceSchema);
