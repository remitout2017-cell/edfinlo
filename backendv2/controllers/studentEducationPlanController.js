// controllers/studentEducationPlanController.js
const StudentEducationPlan = require("../models/StudentEducationPlan");

// @desc Upsert current student's education plan
// @route POST /api/students/education-plan
// @access Private (student)
exports.upsertEducationPlan = async (req, res, next) => {
  try {
    const {
      targetCountry,
      degreeType,
      courseDurationMonths,
      courseDetails,
      loanAmountRequested,
      livingExpenseOption,
    } = req.body;

    const payload = {
      student: req.user._id,
      targetCountry,
      degreeType,
      courseDurationMonths,
      courseDetails,
      loanAmountRequested,
      livingExpenseOption,
    };

    const plan = await StudentEducationPlan.findOneAndUpdate(
      { student: req.user._id },
      payload,
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Education plan saved successfully",
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Get current student's education plan
// @route GET /api/students/education-plan
// @access Private (student)
exports.getMyEducationPlan = async (req, res, next) => {
  try {
    const plan = await StudentEducationPlan.findOne({
      student: req.user._id,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Education plan not found",
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (err) {
    next(err);
  }
};
