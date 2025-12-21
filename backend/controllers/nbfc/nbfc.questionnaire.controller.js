// controllers/nbfc/nbfc.questionnaire.controller.js
const NBFC = require("../../models/nbfc/NBFC");

// @desc    Get NBFC questionnaire/loan config
// @route   GET /api/nbfc/questionnaire
// @access  Private (NBFC only)
exports.getQuestionnaire = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.user.id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        loanConfig: nbfc.loanConfig,
        questionnaireCompleted: nbfc.questionnaireCompleted
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update NBFC questionnaire/loan config
// @route   PUT /api/nbfc/questionnaire
// @access  Private (NBFC only)
exports.updateQuestionnaire = async (req, res, next) => {
  try {
    const { loanConfig } = req.body;

    if (!loanConfig) {
      return res.status(400).json({
        success: false,
        message: "Loan configuration data is required",
      });
    }

    const nbfc = await NBFC.findById(req.user.id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    // Update loan config
    nbfc.loanConfig = { ...nbfc.loanConfig, ...loanConfig };
    nbfc.questionnaireCompleted = true;
    await nbfc.save();

    res.status(200).json({
      success: true,
      message: "Questionnaire updated successfully",
      data: {
        loanConfig: nbfc.loanConfig,
        questionnaireCompleted: nbfc.questionnaireCompleted
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get accepted students list
// @route   GET /api/nbfc/students
// @access  Private (NBFC only)
exports.getAcceptedStudents = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.user.id).populate({
      path: 'acceptedStudents.studentId',
      select: 'firstName lastName email phoneNumber'
    });

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        acceptedStudents: nbfc.acceptedStudents,
        totalCount: nbfc.acceptedStudents.length
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add student to accepted list
// @route   POST /api/nbfc/students/:studentId
// @access  Private (NBFC only)
exports.addAcceptedStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { loanStatus } = req.body;

    const nbfc = await NBFC.findById(req.user.id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    // Check if student already exists
    const exists = nbfc.acceptedStudents.find(
      s => s.studentId.toString() === studentId
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Student already in accepted list",
      });
    }

    // Add student
    nbfc.acceptedStudents.push({
      studentId,
      loanStatus: loanStatus || 'pending',
      acceptedAt: new Date()
    });

    nbfc.stats.totalApplications += 1;
    nbfc.stats.pendingApplications += 1;

    await nbfc.save();

    res.status(200).json({
      success: true,
      message: "Student added to accepted list",
      data: { acceptedStudents: nbfc.acceptedStudents },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student loan status
// @route   PUT /api/nbfc/students/:studentId
// @access  Private (NBFC only)
exports.updateStudentStatus = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { loanStatus } = req.body;

    const nbfc = await NBFC.findById(req.user.id);

    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    const student = nbfc.acceptedStudents.find(
      s => s.studentId.toString() === studentId
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found in accepted list",
      });
    }

    const oldStatus = student.loanStatus;
    student.loanStatus = loanStatus;

    // Update stats
    if (oldStatus !== loanStatus) {
      if (oldStatus === 'pending') nbfc.stats.pendingApplications -= 1;
      if (oldStatus === 'approved') nbfc.stats.approvedApplications -= 1;
      if (oldStatus === 'rejected') nbfc.stats.rejectedApplications -= 1;

      if (loanStatus === 'pending') nbfc.stats.pendingApplications += 1;
      if (loanStatus === 'approved') nbfc.stats.approvedApplications += 1;
      if (loanStatus === 'rejected') nbfc.stats.rejectedApplications += 1;
    }

    await nbfc.save();

    res.status(200).json({
      success: true,
      message: "Student status updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
