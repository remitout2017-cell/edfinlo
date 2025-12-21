// controllers/students/coBorrowerKyc.controller.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const crypto = require("crypto");
const config = require("../../config/config");
const CoBorrower = require("../../models/student/CoBorrower");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const { encryptText, decryptText } = require("../../utils/encryption");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function aadForUser(userId) {
  return String(userId);
}

function safePublicId(userId, docKey) {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `coborrower_${userId}/${docKey}_${Date.now()}_${rnd}`;
}

async function callPythonKycServer(files) {
  const form = new FormData();

  console.log("\n📤 [KYC] Files to send:", {
    aadhaar_front: files.aadhaar_front[0].originalname,
    aadhaar_back: files.aadhaar_back[0].originalname,
    pan_front: files.pan_front[0].originalname,
    passport: files.passport?.[0]?.originalname || "not provided",
  });

  form.append(
    "aadhaar_front",
    fs.createReadStream(files.aadhaar_front[0].path)
  );
  form.append("aadhaar_back", fs.createReadStream(files.aadhaar_back[0].path));
  form.append("pan_front", fs.createReadStream(files.pan_front[0].path));

  if (files.passport?.[0]?.path) {
    form.append("passport", fs.createReadStream(files.passport[0].path));
  }

  console.log(`🔵 [KYC] Calling Python server: ${config.kycServerUrl}`);

  try {
    const resp = await axios.post(config.kycServerUrl, form, {
      headers: form.getHeaders(),
      timeout: 240000,
    });

    console.log(`✅ [KYC] Python response:`, {
      status: resp.data.status,
      verified: resp.data.verified,
    });

    return resp.data;
  } catch (error) {
    console.error("\n❌ [KYC] Python server error:");
    console.error("  Status:", error.response?.status);
    console.error("  Error:", error.response?.data?.error || error.message);

    if (error.response?.data) {
      console.error("  Details:", JSON.stringify(error.response.data, null, 2));
    }

    const errorMsg = error.response?.data?.error || error.message;
    throw new Error(`Python KYC verification failed: ${errorMsg}`);
  }
}

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/coborrower/kyc/upload
 * @desc    Create co-borrower + Submit KYC
 * @access  Private
 */
exports.submitCoBorrowerKyc = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  console.log(`\n${"=".repeat(80)}`);
  console.log(
    `📝 [KYC] New co-borrower KYC submission from student: ${studentId}`
  );
  console.log(`${"=".repeat(80)}\n`);

  const {
    firstName,
    lastName,
    relationToStudent,
    email,
    phoneNumber,
    dateOfBirth,
  } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !relationToStudent) {
    throw new AppError("First name, last name, and relation are required", 400);
  }

  // Validate files
  const files = req.files || {};
  const requiredFiles = ["aadhaar_front", "aadhaar_back", "pan_front"];

  for (const k of requiredFiles) {
    if (!files[k]?.[0]?.path) {
      throw new AppError(`Missing required file: ${k}`, 400);
    }
  }

  // Check for duplicates (only verified co-borrowers)
  console.log("🔍 [Validation] Checking for duplicate co-borrowers...");

  if (email && email.trim() !== "") {
    const existingEmail = await CoBorrower.checkDuplicateEmail(
      studentId,
      email
    );
    if (existingEmail) {
      throw new AppError(
        `Co-borrower with email "${email}" already verified: ${existingEmail.fullName}. Use re-verification endpoint to update documents.`,
        409
      );
    }
  }

  if (phoneNumber && phoneNumber.trim() !== "") {
    const existingPhone = await CoBorrower.checkDuplicatePhone(
      studentId,
      phoneNumber
    );
    if (existingPhone) {
      throw new AppError(
        `Co-borrower with phone number "${phoneNumber}" already verified: ${existingPhone.fullName}. Use re-verification endpoint to update documents.`,
        409
      );
    }
  }

  const existingName = await CoBorrower.checkDuplicateName(
    studentId,
    firstName,
    lastName
  );
  if (existingName) {
    const isSamePerson =
      (email &&
        existingName.email &&
        email.toLowerCase() === existingName.email.toLowerCase()) ||
      (phoneNumber &&
        existingName.phoneNumber &&
        phoneNumber === existingName.phoneNumber);

    if (isSamePerson) {
      throw new AppError(
        `Co-borrower "${existingName.fullName}" already verified with ID: ${existingName._id}. Use re-verification endpoint: PUT /api/coborrower/${existingName._id}/kyc/reverify`,
        409
      );
    } else {
      console.log(
        `⚠️  [Validation] Co-borrower with same name exists but different contact - allowing`
      );
    }
  }

  console.log("✅ [Validation] No duplicates found\n");

  // Call Python KYC Server
  let kycResp;
  try {
    kycResp = await callPythonKycServer(files);
  } catch (error) {
    console.error("❌ [KYC] Python server error:", error.message);
    throw new AppError(`KYC verification failed: ${error.message}`, 503);
  }

  const verified = !!kycResp.verified;
  const reasons = Array.isArray(kycResp.reasons) ? kycResp.reasons : [];

  console.log(
    `✅ [KYC] Verification result: ${verified ? "VERIFIED ✓" : "REJECTED ✗"}`
  );
  if (reasons.length > 0) {
    console.log(`⚠️  [KYC] Reasons:`, reasons);
  }

  // Create new co-borrower
  const coBorrower = new CoBorrower({
    student: studentId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    relationToStudent,
    email: email?.trim() || null,
    phoneNumber: phoneNumber?.trim() || null,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    kycStatus: "pending",
  });

  console.log(`✅ [KYC] Co-borrower created (pending): ${coBorrower._id}`);

  // Upload to Cloudinary
  const uploaded = {};
  try {
    console.log(`\n🔵 [Cloudinary] Uploading KYC documents...`);

    uploaded.aadhaar_front = await uploadToCloudinary(
      files.aadhaar_front[0].path,
      {
        filename: safePublicId(coBorrower._id, "aadhaar_front"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.aadhaar_back = await uploadToCloudinary(
      files.aadhaar_back[0].path,
      {
        filename: safePublicId(coBorrower._id, "aadhaar_back"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.pan_front = await uploadToCloudinary(files.pan_front[0].path, {
      filename: safePublicId(coBorrower._id, "pan_front"),
      folder: "coborrower_kyc_documents",
      type: "authenticated",
    });

    if (files.passport?.[0]?.path) {
      uploaded.passport = await uploadToCloudinary(files.passport[0].path, {
        filename: safePublicId(coBorrower._id, "passport"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      });
    }

    console.log(`✅ [Cloudinary] All documents uploaded successfully`);
  } catch (e) {
    console.error("❌ [Cloudinary] Upload failed:", e.message);

    await Promise.allSettled(
      Object.values(uploaded)
        .filter((u) => u?.public_id)
        .map((u) =>
          deleteFromCloudinary({
            publicId: u.public_id,
            resourceType: u.resource_type,
            type: u.type,
          })
        )
    );

    throw new AppError(`Cloud upload failed: ${e.message}`, 500);
  }

  // Save KYC data
  const aad = aadForUser(coBorrower._id);
  const aadhaarNumberPlain = kycResp?.kycData?.aadhaarNumber ?? null;
  const panNumberPlain = kycResp?.kycData?.panNumber ?? null;
  const passportNumberPlain = kycResp?.kycData?.passportNumber ?? null;

  coBorrower.kycStatus = verified ? "verified" : "rejected";
  coBorrower.kycVerifiedAt = verified ? new Date() : null;
  coBorrower.kycRejectedAt = verified ? null : new Date();

  coBorrower.kycData = {
    aadhaarFrontUrl: uploaded.aadhaar_front.secure_url,
    aadhaarBackUrl: uploaded.aadhaar_back.secure_url,
    panFrontUrl: uploaded.pan_front.secure_url,
    passportUrl: uploaded.passport?.secure_url || "",

    aadhaarFrontPublicId: uploaded.aadhaar_front.public_id,
    aadhaarBackPublicId: uploaded.aadhaar_back.public_id,
    panFrontPublicId: uploaded.pan_front.public_id,
    passportPublicId: uploaded.passport?.public_id || "",

    aadhaarFrontResourceType: uploaded.aadhaar_front.resource_type,
    aadhaarBackResourceType: uploaded.aadhaar_back.resource_type,
    panFrontResourceType: uploaded.pan_front.resource_type,
    passportResourceType: uploaded.passport?.resource_type || "image",

    aadhaarFrontType: uploaded.aadhaar_front.type,
    aadhaarBackType: uploaded.aadhaar_back.type,
    panFrontType: uploaded.pan_front.type,
    passportType: uploaded.passport?.type || "authenticated",

    aadhaarNumber: encryptText(aadhaarNumberPlain, aad),
    panNumber: encryptText(panNumberPlain, aad),
    passportNumber: encryptText(passportNumberPlain, aad),

    aadhaarName: kycResp?.kycData?.aadhaarName || null,
    aadhaarGender: kycResp?.kycData?.aadhaarGender || null,
    aadhaarAddress: kycResp?.kycData?.aadhaarAddress || null,
    aadhaarDOB: kycResp?.kycData?.aadhaarDOB || null,
    panName: kycResp?.kycData?.panName || null,
    panFatherName: kycResp?.kycData?.panFatherName || null,
    panDOB: kycResp?.kycData?.panDOB || null,
    passportName: kycResp?.kycData?.passportName || null,

    verificationScore: kycResp?.kycData?.verification?.score || 0,
    verificationMethod:
      kycResp?.kycData?.verification?.verifier_used || "Unknown",
    verificationReason: reasons.join(", "),
    lastVerifiedAt: new Date(),
  };

  await coBorrower.save();
  console.log(`✅ [DB] Co-borrower saved with KYC data: ${coBorrower._id}`);

  // Add to student's array
  const student = await Student.findById(studentId);
  if (student) {
    await student.addCoBorrower(coBorrower._id);
    console.log(`✅ [DB] Co-borrower added to student's array`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ [KYC] Request complete - Status: ${coBorrower.kycStatus}`);
  console.log(`${"=".repeat(80)}\n`);

  return res.status(201).json({
    success: true,
    message: verified
      ? "Co-borrower created and KYC verified successfully"
      : "Co-borrower created but KYC verification failed. Please re-verify with better quality documents.",
    status: verified ? "verified" : "rejected",
    verified,
    reasons,
    coBorrower: {
      id: coBorrower._id,
      firstName: coBorrower.firstName,
      lastName: coBorrower.lastName,
      fullName: coBorrower.fullName,
      relationToStudent: coBorrower.relationToStudent,
      email: coBorrower.email,
      phoneNumber: coBorrower.phoneNumber,
      kycStatus: coBorrower.kycStatus,
      kycVerifiedAt: coBorrower.kycVerifiedAt,
      kycRejectedAt: coBorrower.kycRejectedAt,
    },
    kycData: verified
      ? {
          aadhaarNumber: decryptText(coBorrower.kycData.aadhaarNumber, aad),
          panNumber: decryptText(coBorrower.kycData.panNumber, aad),
          passportNumber: decryptText(coBorrower.kycData.passportNumber, aad),
          aadhaarName: coBorrower.kycData.aadhaarName,
          panName: coBorrower.kycData.panName,
          aadhaarAddress: coBorrower.kycData.aadhaarAddress,
          aadhaarFrontUrl: coBorrower.kycData.aadhaarFrontUrl,
          aadhaarBackUrl: coBorrower.kycData.aadhaarBackUrl,
          panFrontUrl: coBorrower.kycData.panFrontUrl,
          passportUrl: coBorrower.kycData.passportUrl,
        }
      : null,
    nextStep: verified
      ? "upload_financial_documents"
      : `reverify_kyc_using_PUT_/api/coborrower/${coBorrower._id}/kyc/reverify`,
  });
});

/**
 * @route   PUT /api/coborrower/:coBorrowerId/kyc/reverify
 * @desc    Re-verify KYC for rejected co-borrower
 * @access  Private
 */
exports.reverifyKyc = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔄 [KYC] Re-verification request for: ${coBorrowerId}`);
  console.log(`${"=".repeat(80)}\n`);

  // Find existing co-borrower
  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  }).select(
    "+kycData.aadhaarFrontPublicId +kycData.aadhaarBackPublicId +kycData.panFrontPublicId +kycData.passportPublicId +kycData.aadhaarFrontResourceType +kycData.aadhaarBackResourceType +kycData.panFrontResourceType +kycData.passportResourceType +kycData.aadhaarFrontType +kycData.aadhaarBackType +kycData.panFrontType +kycData.passportType"
  );

  if (!coBorrower) {
    throw new AppError("Co-borrower not found", 404);
  }

  // Only allow re-verification if KYC is rejected or pending
  if (coBorrower.kycStatus === "verified") {
    throw new AppError(
      "KYC already verified. Cannot re-verify verified documents.",
      400
    );
  }

  console.log(`📋 [KYC] Current status: ${coBorrower.kycStatus}`);
  console.log(`👤 [KYC] Co-borrower: ${coBorrower.fullName}`);

  // Validate new files
  const files = req.files || {};
  const requiredFiles = ["aadhaar_front", "aadhaar_back", "pan_front"];

  for (const k of requiredFiles) {
    if (!files[k]?.[0]?.path) {
      throw new AppError(`Missing required file: ${k}`, 400);
    }
  }

  // Delete old Cloudinary images
  if (coBorrower.kycData) {
    console.log(`\n🗑️  [Cloudinary] Deleting old KYC documents...`);

    const oldImages = [
      {
        publicId: coBorrower.kycData.aadhaarFrontPublicId,
        resourceType: coBorrower.kycData.aadhaarFrontResourceType || "image",
        type: coBorrower.kycData.aadhaarFrontType || "authenticated",
      },
      {
        publicId: coBorrower.kycData.aadhaarBackPublicId,
        resourceType: coBorrower.kycData.aadhaarBackResourceType || "image",
        type: coBorrower.kycData.aadhaarBackType || "authenticated",
      },
      {
        publicId: coBorrower.kycData.panFrontPublicId,
        resourceType: coBorrower.kycData.panFrontResourceType || "image",
        type: coBorrower.kycData.panFrontType || "authenticated",
      },
    ];

    if (coBorrower.kycData.passportPublicId) {
      oldImages.push({
        publicId: coBorrower.kycData.passportPublicId,
        resourceType: coBorrower.kycData.passportResourceType || "image",
        type: coBorrower.kycData.passportType || "authenticated",
      });
    }

    await Promise.allSettled(
      oldImages
        .filter((img) => img.publicId)
        .map((img) => deleteFromCloudinary(img))
    );

    console.log(`✅ [Cloudinary] Old documents cleanup complete`);
  }

  // Call Python KYC Server
  let kycResp;
  try {
    kycResp = await callPythonKycServer(files);
  } catch (error) {
    console.error("❌ [KYC] Python server error:", error.message);
    throw new AppError(`KYC verification failed: ${error.message}`, 503);
  }

  const verified = !!kycResp.verified;
  const reasons = Array.isArray(kycResp.reasons) ? kycResp.reasons : [];

  console.log(
    `✅ [KYC] Re-verification result: ${verified ? "VERIFIED ✓" : "REJECTED ✗"}`
  );
  if (reasons.length > 0) {
    console.log(`⚠️  [KYC] Reasons:`, reasons);
  }

  // Upload new images to Cloudinary
  const uploaded = {};
  try {
    console.log(`\n🔵 [Cloudinary] Uploading new KYC documents...`);

    uploaded.aadhaar_front = await uploadToCloudinary(
      files.aadhaar_front[0].path,
      {
        filename: safePublicId(coBorrower._id, "aadhaar_front"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.aadhaar_back = await uploadToCloudinary(
      files.aadhaar_back[0].path,
      {
        filename: safePublicId(coBorrower._id, "aadhaar_back"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.pan_front = await uploadToCloudinary(files.pan_front[0].path, {
      filename: safePublicId(coBorrower._id, "pan_front"),
      folder: "coborrower_kyc_documents",
      type: "authenticated",
    });

    if (files.passport?.[0]?.path) {
      uploaded.passport = await uploadToCloudinary(files.passport[0].path, {
        filename: safePublicId(coBorrower._id, "passport"),
        folder: "coborrower_kyc_documents",
        type: "authenticated",
      });
    }

    console.log(`✅ [Cloudinary] All new documents uploaded successfully`);
  } catch (e) {
    console.error("❌ [Cloudinary] Upload failed:", e.message);

    await Promise.allSettled(
      Object.values(uploaded)
        .filter((u) => u?.public_id)
        .map((u) =>
          deleteFromCloudinary({
            publicId: u.public_id,
            resourceType: u.resource_type,
            type: u.type,
          })
        )
    );

    throw new AppError(`Cloud upload failed: ${e.message}`, 500);
  }

  // Update co-borrower with new KYC data
  const aad = aadForUser(coBorrower._id);
  const aadhaarNumberPlain = kycResp?.kycData?.aadhaarNumber ?? null;
  const panNumberPlain = kycResp?.kycData?.panNumber ?? null;
  const passportNumberPlain = kycResp?.kycData?.passportNumber ?? null;

  coBorrower.kycStatus = verified ? "verified" : "rejected";
  coBorrower.kycVerifiedAt = verified ? new Date() : null;
  coBorrower.kycRejectedAt = verified ? null : new Date();

  coBorrower.kycData = {
    aadhaarFrontUrl: uploaded.aadhaar_front.secure_url,
    aadhaarBackUrl: uploaded.aadhaar_back.secure_url,
    panFrontUrl: uploaded.pan_front.secure_url,
    passportUrl: uploaded.passport?.secure_url || "",

    aadhaarFrontPublicId: uploaded.aadhaar_front.public_id,
    aadhaarBackPublicId: uploaded.aadhaar_back.public_id,
    panFrontPublicId: uploaded.pan_front.public_id,
    passportPublicId: uploaded.passport?.public_id || "",

    aadhaarFrontResourceType: uploaded.aadhaar_front.resource_type,
    aadhaarBackResourceType: uploaded.aadhaar_back.resource_type,
    panFrontResourceType: uploaded.pan_front.resource_type,
    passportResourceType: uploaded.passport?.resource_type || "image",

    aadhaarFrontType: uploaded.aadhaar_front.type,
    aadhaarBackType: uploaded.aadhaar_back.type,
    panFrontType: uploaded.pan_front.type,
    passportType: uploaded.passport?.type || "authenticated",

    aadhaarNumber: encryptText(aadhaarNumberPlain, aad),
    panNumber: encryptText(panNumberPlain, aad),
    passportNumber: encryptText(passportNumberPlain, aad),

    aadhaarName: kycResp?.kycData?.aadhaarName || null,
    aadhaarGender: kycResp?.kycData?.aadhaarGender || null,
    aadhaarAddress: kycResp?.kycData?.aadhaarAddress || null,
    aadhaarDOB: kycResp?.kycData?.aadhaarDOB || null,
    panName: kycResp?.kycData?.panName || null,
    panFatherName: kycResp?.kycData?.panFatherName || null,
    panDOB: kycResp?.kycData?.panDOB || null,
    passportName: kycResp?.kycData?.passportName || null,

    verificationScore: kycResp?.kycData?.verification?.score || 0,
    verificationMethod:
      kycResp?.kycData?.verification?.verifier_used || "Unknown",
    verificationReason: reasons.join(", "),
    lastVerifiedAt: new Date(),
  };

  await coBorrower.save();
  console.log(`✅ [DB] Co-borrower updated with new KYC data`);

  console.log(`\n${"=".repeat(80)}`);
  console.log(
    `✅ [KYC] Re-verification complete - Status: ${coBorrower.kycStatus}`
  );
  console.log(`${"=".repeat(80)}\n`);

  return res.status(200).json({
    success: true,
    message: verified
      ? "KYC re-verified successfully"
      : "KYC re-verification failed. Please check the uploaded documents and try again.",
    status: verified ? "verified" : "rejected",
    verified,
    reasons,
    coBorrower: {
      id: coBorrower._id,
      firstName: coBorrower.firstName,
      lastName: coBorrower.lastName,
      fullName: coBorrower.fullName,
      relationToStudent: coBorrower.relationToStudent,
      email: coBorrower.email,
      phoneNumber: coBorrower.phoneNumber,
      kycStatus: coBorrower.kycStatus,
      kycVerifiedAt: coBorrower.kycVerifiedAt,
      kycRejectedAt: coBorrower.kycRejectedAt,
    },
    kycData: verified
      ? {
          aadhaarNumber: decryptText(coBorrower.kycData.aadhaarNumber, aad),
          panNumber: decryptText(coBorrower.kycData.panNumber, aad),
          passportNumber: decryptText(coBorrower.kycData.passportNumber, aad),
          aadhaarName: coBorrower.kycData.aadhaarName,
          panName: coBorrower.kycData.panName,
          aadhaarAddress: coBorrower.kycData.aadhaarAddress,
          aadhaarFrontUrl: coBorrower.kycData.aadhaarFrontUrl,
          aadhaarBackUrl: coBorrower.kycData.aadhaarBackUrl,
          panFrontUrl: coBorrower.kycData.panFrontUrl,
          passportUrl: coBorrower.kycData.passportUrl,
        }
      : null,
    nextStep: verified
      ? "upload_financial_documents"
      : "retry_with_better_quality_documents",
  });
});

/**
 * @route   GET /api/coborrower/list
 * @desc    Get all co-borrowers for logged-in student (newest first)
 * @access  Private
 */
exports.getAllCoBorrowers = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const coBorrowers = await CoBorrower.find({
    student: studentId,
    isDeleted: false,
  })
    .select(
      "firstName lastName relationToStudent email phoneNumber kycStatus financialVerificationStatus createdAt"
    )
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    count: coBorrowers.length,
    coBorrowers: coBorrowers.map((cb) => ({
      id: cb._id,
      fullName: cb.fullName,
      relationToStudent: cb.relationToStudent,
      email: cb.email,
      phoneNumber: cb.phoneNumber,
      kycStatus: cb.kycStatus,
      financialStatus: cb.financialVerificationStatus,
      createdAt: cb.createdAt,
    })),
  });
});

/**
 * @route   GET /api/coborrower/:coBorrowerId
 * @desc    Get single co-borrower details
 * @access  Private
 */
exports.getCoBorrowerById = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  }).select(
    "firstName lastName relationToStudent email phoneNumber dateOfBirth " +
      "kycStatus kycVerifiedAt kycRejectedAt financialVerificationStatus " +
      "financialVerifiedAt financialSummary " +
      "+kycData.aadhaarNumber +kycData.panNumber +kycData.passportNumber " +
      "+kycData.aadhaarFrontUrl +kycData.aadhaarBackUrl +kycData.panFrontUrl +kycData.passportUrl " +
      "kycData.aadhaarName kycData.panName kycData.aadhaarAddress"
  );

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);

  const aad = aadForUser(coBorrowerId);

  return res.json({
    success: true,
    coBorrower: {
      id: coBorrower._id,
      fullName: coBorrower.fullName,
      firstName: coBorrower.firstName,
      lastName: coBorrower.lastName,
      relationToStudent: coBorrower.relationToStudent,
      email: coBorrower.email,
      phoneNumber: coBorrower.phoneNumber,
      dateOfBirth: coBorrower.dateOfBirth,
      age: coBorrower.age,
      kycStatus: coBorrower.kycStatus,
      kycVerifiedAt: coBorrower.kycVerifiedAt,
      kycRejectedAt: coBorrower.kycRejectedAt,
      financialStatus: coBorrower.financialVerificationStatus,
      financialVerifiedAt: coBorrower.financialVerifiedAt,
      financialSummary: coBorrower.financialSummary,
      kycData: coBorrower.kycData
        ? {
            aadhaarNumber: decryptText(coBorrower.kycData.aadhaarNumber, aad),
            panNumber: decryptText(coBorrower.kycData.panNumber, aad),
            passportNumber: decryptText(coBorrower.kycData.passportNumber, aad),
            aadhaarName: coBorrower.kycData.aadhaarName,
            panName: coBorrower.kycData.panName,
            aadhaarAddress: coBorrower.kycData.aadhaarAddress,
            aadhaarFrontUrl: coBorrower.kycData.aadhaarFrontUrl,
            aadhaarBackUrl: coBorrower.kycData.aadhaarBackUrl,
            panFrontUrl: coBorrower.kycData.panFrontUrl,
            passportUrl: coBorrower.kycData.passportUrl,
          }
        : null,
    },
  });
});

/**
 * @route   DELETE /api/coborrower/:coBorrowerId
 * @desc    Soft delete a co-borrower
 * @access  Private
 */
exports.deleteCoBorrower = asyncHandler(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) throw new AppError("Unauthorized", 401);

  const { coBorrowerId } = req.params;

  const coBorrower = await CoBorrower.findOne({
    _id: coBorrowerId,
    student: studentId,
    isDeleted: false,
  });

  if (!coBorrower) throw new AppError("Co-borrower not found", 404);

  await coBorrower.softDelete();

  const student = await Student.findById(studentId);
  if (student) {
    await student.removeCoBorrower(coBorrowerId);
  }

  return res.json({
    success: true,
    message: "Co-borrower deleted successfully",
  });
});
