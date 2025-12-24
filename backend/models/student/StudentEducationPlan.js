// models/StudentEducationPlan.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const StudentEducationPlanSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student", // same as your students.js model
      required: true,
      unique: true, // one education plan per student
      index: true,
    },

    // Target program info
    targetCountry: {
      type: String,
      required: true,
      trim: true,
    },
    degreeType: {
      type: String,
      required: true,
      trim: true,
    },
    courseDurationMonths: {
      type: Number,
      required: true,
      min: 1,
    },

    // Course and loan details
    courseDetails: {
      type: String,
      required: false,
      trim: true,
    },
    loanAmountRequested: {
      type: Number,
      required: true,
      min: 0,
    },
    livingExpenseOption: {
      type: String,
      enum: ["WITH_LIVING_EXPENSE", "WITHOUT_LIVING_EXPENSE"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.StudentEducationPlan ||
  mongoose.model("StudentEducationPlan", StudentEducationPlanSchema);
