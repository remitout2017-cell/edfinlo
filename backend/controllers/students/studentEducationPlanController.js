// controllers/studentEducationPlanController.js
const StudentEducationPlan = require("../../models/student/StudentEducationPlan");
const { updateStudentDocumentHash } = require("../../utils/documentHasher");

exports.upsertEducationPlan = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const {
      targetCountry,
      degreeType,
      courseDurationMonths,
      courseDetails,
      loanAmountRequested,
      livingExpenseOption,
    } = req.body;

    const payload = {
      student: studentId,
      targetCountry,
      degreeType,
      courseDurationMonths,
      courseDetails,
      loanAmountRequested,
      livingExpenseOption,
    };

    Object.keys(payload).forEach(
      (key) => payload[key] === undefined && delete payload[key]
    );

    const plan = await StudentEducationPlan.findOneAndUpdate(
      { student: studentId },
      payload,
      { upsert: true, new: true, runValidators: true }
    );

    await updateStudentDocumentHash(studentId);

    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    return next(err);
  }
};

exports.getMyEducationPlan = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const plan = await StudentEducationPlan.findOne({ student: studentId });

    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Education plan not found" });
    }

    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    return next(err);
  }
};
