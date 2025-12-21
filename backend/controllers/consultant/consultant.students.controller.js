// controllers/consultant/consultant.students.controller.js
const Consultant = require("../../models/consultant/Consultant");
const Student = require("../../models/student/students");
const AcademicRecords = require("../../models/student/AcademicRecords");
const TestScores = require("../../models/student/TestScores");
const Workexperience = require("../../models/student/Workexperience");
const CoBorrower = require("../../models/student/CoBorrower");
const AdmissionLetter = require("../../models/student/AdmissionLetter");
const { sendStudentInviteEmail } = require("../../utils/phoneVerification");
const crypto = require("crypto");

// @desc    Invite a student by email
// @route   POST /api/consultant/students/invite
// @access  Private (Consultant only)
exports.inviteStudent = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const consultant = await Consultant.findById(req.user.id);

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    // Check if email already invited by THIS consultant
    const alreadyInvited = consultant.invitedStudents.find(
      (inv) => inv.email === email.toLowerCase()
    );

    if (alreadyInvited) {
      return res.status(400).json({
        success: false,
        message: "You have already sent an invitation to this email",
      });
    }

    // Check if email already invited by ANY consultant
    const otherConsultantInvite = await Consultant.findOne({
      "invitedStudents.email": email.toLowerCase(),
      _id: { $ne: req.user.id },
    });

    if (otherConsultantInvite) {
      return res.status(400).json({
        success: false,
        message: "This email has already been invited by another consultant",
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      email: email.toLowerCase(),
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "A student with this email already exists",
      });
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Add to invited students
    consultant.invitedStudents.push({
      email: email.toLowerCase(),
      token,
      expiresAt,
      accepted: false,
      sentAt: new Date(),
    });

    consultant.stats.pendingInvites += 1;
    await consultant.save();

    // Send invitation email
    const inviteLink = `${process.env.FRONTEND_URL}/register?token=${token}&email=${email}`;

    try {
      await sendStudentInviteEmail(
        email,
        inviteLink,
        `${consultant.firstName} ${consultant.lastName}`,
        consultant.companyName
      );

      res.status(200).json({
        success: true,
        message: "Invitation sent successfully",
        data: {
          email: email.toLowerCase(),
          expiresAt,
          inviteLink, // Remove in production
        },
      });
    } catch (emailError) {
      // Rollback invitation
      consultant.invitedStudents.pop();
      consultant.stats.pendingInvites -= 1;
      await consultant.save();

      return res.status(500).json({
        success: false,
        message: "Failed to send invitation email",
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all students managed by consultant
// @route   GET /api/consultant/students
// @access  Private (Consultant only)
exports.getAllStudents = async (req, res, next) => {
  try {
    const consultant = await Consultant.findById(req.user.id).populate({
      path: "students",
      select:
        "firstName lastName email phoneNumber kycStatus isActive lastLogin createdAt",
    });

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        students: consultant.students,
        totalCount: consultant.students.length,
        stats: consultant.stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed student progress
// @route   GET /api/consultant/students/:studentId/progress
// @access  Private (Consultant only)
exports.getStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const consultant = await Consultant.findById(req.user.id);

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    // Verify student belongs to this consultant
    if (!consultant.students.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student's data",
      });
    }

    // Fetch student with all populated data
    const student = await Student.findById(studentId)
      .populate("academicRecords")
      .populate("testScores")
      .populate("workExperience")
      .populate("coBorrowers")
      .populate("admissionLetters");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Calculate progress
    const progress = calculateStudentProgress(student);

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          isActive: student.isActive,
          lastLogin: student.lastLogin,
        },
        progress,
        details: {
          kyc: getKYCDetails(student),
          academics: getAcademicsDetails(student.academicRecords),
          testScores: getTestScoresDetails(student.testScores),
          workExperience: getWorkExperienceDetails(student.workExperience),
          admissionLetters: getAdmissionLettersDetails(
            student.admissionLetters
          ),
          coBorrowers: getCoBorrowersDetails(student.coBorrowers),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all students with their progress summary
// @route   GET /api/consultant/students/progress-summary
// @access  Private (Consultant only)
exports.getStudentsProgressSummary = async (req, res, next) => {
  try {
    const consultant = await Consultant.findById(req.user.id);

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    const students = await Student.find({ _id: { $in: consultant.students } })
      .populate("academicRecords")
      .populate("testScores")
      .populate("workExperience")
      .populate("coBorrowers")
      .populate("admissionLetters");

    const studentsWithProgress = students.map((student) => {
      const progress = calculateStudentProgress(student);

      return {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        kycStatus: student.kycStatus,
        overallProgress: progress.overallProgress,
        completedSections: progress.completedSections,
        totalSections: progress.totalSections,
        progressPercentage: progress.progressPercentage,
        lastLogin: student.lastLogin,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        students: studentsWithProgress,
        totalCount: studentsWithProgress.length,
        stats: consultant.stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending invitations
// @route   GET /api/consultant/students/invitations
// @access  Private (Consultant only)
exports.getPendingInvitations = async (req, res, next) => {
  try {
    const consultant = await Consultant.findById(req.user.id);

    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: "Consultant not found",
      });
    }

    const now = new Date();

    const invitations = consultant.invitedStudents.map((inv) => ({
      email: inv.email,
      sentAt: inv.sentAt,
      expiresAt: inv.expiresAt,
      accepted: inv.accepted,
      isExpired: inv.expiresAt < now,
      status: inv.accepted
        ? "accepted"
        : inv.expiresAt < now
        ? "expired"
        : "pending",
    }));

    res.status(200).json({
      success: true,
      data: {
        invitations,
        totalCount: invitations.length,
        pendingCount: invitations.filter((i) => i.status === "pending").length,
        acceptedCount: invitations.filter((i) => i.accepted).length,
        expiredCount: invitations.filter((i) => i.status === "expired").length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate student progress
function calculateStudentProgress(student) {
  const sections = {
    profile: {
      name: "Profile",
      completed: !!(
        student.firstName &&
        student.lastName &&
        student.email &&
        student.phoneNumber
      ),
      documents: 0,
      totalDocuments: 0,
    },
    kyc: {
      name: "KYC Verification",
      completed: student.kycStatus === "verified",
      documents: 0,
      totalDocuments: 3, // Aadhaar, PAN, Passport
    },
    academics: {
      name: "Academic Records",
      completed: false,
      documents: 0,
      totalDocuments: 0,
    },
    testScores: {
      name: "Test Scores",
      completed: false,
      documents: 0,
      totalDocuments: 0,
    },
    workExperience: {
      name: "Work Experience",
      completed: false,
      documents: 0,
      totalDocuments: 0,
    },
    admissionLetter: {
      name: "Admission Letter",
      completed: false,
      documents: 0,
      totalDocuments: 1,
    },
    coBorrower: {
      name: "Co-Borrower",
      completed: false,
      documents: 0,
      totalDocuments: 0,
    },
  };

  // KYC Documents count
  if (student.kycData) {
    if (student.kycData.aadhaarFrontUrl) sections.kyc.documents += 1;
    if (student.kycData.panCardUrl) sections.kyc.documents += 1;
    if (student.kycData.passportUrl) sections.kyc.documents += 1;
  }

  // Academic Records
  if (student.academicRecords) {
    const academic = student.academicRecords;
    let academicDocs = 0;
    let totalAcademicDocs = 0;

    if (academic.tenthGrade) {
      totalAcademicDocs += 1;
      if (academic.tenthGrade.marksheetUrl) academicDocs += 1;
    }
    if (academic.twelfthGrade) {
      totalAcademicDocs += 1;
      if (academic.twelfthGrade.marksheetUrl) academicDocs += 1;
    }
    if (academic.graduation) {
      totalAcademicDocs += 1;
      if (academic.graduation.transcriptUrl) academicDocs += 1;
    }
    if (academic.postGraduation) {
      totalAcademicDocs += 1;
      if (academic.postGraduation.transcriptUrl) academicDocs += 1;
    }

    sections.academics.documents = academicDocs;
    sections.academics.totalDocuments = totalAcademicDocs;
    sections.academics.completed =
      totalAcademicDocs > 0 && academicDocs === totalAcademicDocs;
  }

  // Test Scores
  if (student.testScores) {
    let testDocs = 0;
    let totalTestDocs = 0;

    if (student.testScores.ielts) {
      totalTestDocs += 1;
      if (student.testScores.ielts.scoreReportUrl) testDocs += 1;
    }
    if (student.testScores.toefl) {
      totalTestDocs += 1;
      if (student.testScores.toefl.scoreReportUrl) testDocs += 1;
    }
    if (student.testScores.gre) {
      totalTestDocs += 1;
      if (student.testScores.gre.scoreReportUrl) testDocs += 1;
    }
    if (student.testScores.gmat) {
      totalTestDocs += 1;
      if (student.testScores.gmat.scoreReportUrl) testDocs += 1;
    }

    sections.testScores.documents = testDocs;
    sections.testScores.totalDocuments = totalTestDocs;
    sections.testScores.completed =
      totalTestDocs > 0 && testDocs === totalTestDocs;
  }

  // Work Experience
  if (student.workExperience && student.workExperience.experiences) {
    const experiences = student.workExperience.experiences;
    sections.workExperience.totalDocuments = experiences.length;
    sections.workExperience.documents = experiences.filter(
      (exp) => exp.experienceLetterUrl
    ).length;
    sections.workExperience.completed =
      experiences.length > 0 &&
      sections.workExperience.documents ===
        sections.workExperience.totalDocuments;
  }

  // Admission Letters
  if (student.admissionLetters && student.admissionLetters.length > 0) {
    sections.admissionLetter.documents = student.admissionLetters.filter(
      (letter) => letter.admissionLetterUrl
    ).length;
    sections.admissionLetter.completed = sections.admissionLetter.documents > 0;
  }

  // Co-Borrower
  if (student.coBorrowers && student.coBorrowers.length > 0) {
    const coBorrower = student.coBorrowers[0]; // Primary co-borrower
    let coBorrowerDocs = 0;
    let totalCoBorrowerDocs = 3; // Aadhaar, PAN, Income proof

    if (coBorrower.aadhaarFrontUrl) coBorrowerDocs += 1;
    if (coBorrower.panCardUrl) coBorrowerDocs += 1;
    if (coBorrower.incomeProofUrl) coBorrowerDocs += 1;

    sections.coBorrower.documents = coBorrowerDocs;
    sections.coBorrower.totalDocuments = totalCoBorrowerDocs;
    sections.coBorrower.completed = coBorrowerDocs === totalCoBorrowerDocs;
  }

  // Calculate overall progress
  const completedSections = Object.values(sections).filter(
    (s) => s.completed
  ).length;
  const totalSections = Object.keys(sections).length;
  const progressPercentage = Math.round(
    (completedSections / totalSections) * 100
  );

  // Calculate total documents
  const totalDocumentsUploaded = Object.values(sections).reduce(
    (sum, s) => sum + s.documents,
    0
  );
  const totalDocumentsRequired = Object.values(sections).reduce(
    (sum, s) => sum + s.totalDocuments,
    0
  );

  return {
    sections,
    completedSections,
    totalSections,
    progressPercentage,
    totalDocumentsUploaded,
    totalDocumentsRequired,
    overallProgress: `${completedSections}/${totalSections} sections completed`,
  };
}

// Helper functions for details
function getKYCDetails(student) {
  return {
    status: student.kycStatus,
    verifiedAt: student.kycVerifiedAt,
    method: student.kycVerificationMethod,
    documents: {
      aadhaar: !!student.kycData?.aadhaarFrontUrl,
      pan: !!student.kycData?.panCardUrl,
      passport: !!student.kycData?.passportUrl,
    },
  };
}

function getAcademicsDetails(academicRecords) {
  if (!academicRecords) return null;

  return {
    tenthGrade: academicRecords.tenthGrade
      ? {
          board: academicRecords.tenthGrade.board,
          percentage: academicRecords.tenthGrade.percentage,
          hasDocument: !!academicRecords.tenthGrade.marksheetUrl,
        }
      : null,
    twelfthGrade: academicRecords.twelfthGrade
      ? {
          board: academicRecords.twelfthGrade.board,
          percentage: academicRecords.twelfthGrade.percentage,
          hasDocument: !!academicRecords.twelfthGrade.marksheetUrl,
        }
      : null,
    graduation: academicRecords.graduation
      ? {
          degree: academicRecords.graduation.degree,
          cgpa: academicRecords.graduation.cgpa,
          hasDocument: !!academicRecords.graduation.transcriptUrl,
        }
      : null,
  };
}

function getTestScoresDetails(testScores) {
  if (!testScores) return null;

  const details = {};

  if (testScores.ielts) {
    details.ielts = {
      overallBand: testScores.ielts.overallBand,
      hasDocument: !!testScores.ielts.scoreReportUrl,
    };
  }

  if (testScores.toefl) {
    details.toefl = {
      totalScore: testScores.toefl.totalScore,
      hasDocument: !!testScores.toefl.scoreReportUrl,
    };
  }

  if (testScores.gre) {
    details.gre = {
      totalScore: testScores.gre.totalScore,
      hasDocument: !!testScores.gre.scoreReportUrl,
    };
  }

  if (testScores.gmat) {
    details.gmat = {
      totalScore: testScores.gmat.totalScore,
      hasDocument: !!testScores.gmat.scoreReportUrl,
    };
  }

  return Object.keys(details).length > 0 ? details : null;
}

function getWorkExperienceDetails(workExperience) {
  if (!workExperience || !workExperience.experiences) return null;

  return {
    totalExperiences: workExperience.experiences.length,
    experiences: workExperience.experiences.map((exp) => ({
      company: exp.companyName,
      designation: exp.designation,
      duration: `${exp.startDate} to ${exp.endDate || "Present"}`,
      hasDocument: !!exp.experienceLetterUrl,
    })),
  };
}

function getAdmissionLettersDetails(admissionLetters) {
  if (!admissionLetters || admissionLetters.length === 0) return null;

  return {
    totalLetters: admissionLetters.length,
    letters: admissionLetters.map((letter) => ({
      university: letter.universityName,
      course: letter.courseName,
      country: letter.country,
      hasDocument: !!letter.admissionLetterUrl,
      status: letter.status,
    })),
  };
}

function getCoBorrowersDetails(coBorrowers) {
  if (!coBorrowers || coBorrowers.length === 0) return null;

  return {
    totalCoBorrowers: coBorrowers.length,
    coBorrowers: coBorrowers.map((cb) => ({
      name: `${cb.firstName} ${cb.lastName}`,
      relation: cb.relationToStudent,
      hasAadhaar: !!cb.aadhaarFrontUrl,
      hasPAN: !!cb.panCardUrl,
      hasIncomeProof: !!cb.incomeProofUrl,
    })),
  };
}

// ✅ DO NOT ADD module.exports = {} here - functions are already exported above
