// controllers/kyc.controller.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const crypto = require("crypto");

const config = require("../../config/config");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const { encryptText, decryptText } = require("../../utils/encryption");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");
const { updateStudentDocumentHash } = require("../../utils/documentHasher");

function aadForUser(userId) {
  return String(userId);
}

function safePublicId(userId, docKey) {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `student_${userId}/${docKey}_${Date.now()}_${rnd}`;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Handle DD/MM/YYYY format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    // Month is 0-indexed in JS Date
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }
  // Fallback to standard parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function callPythonKycServer(files) {
  const form = new FormData();

  form.append(
    "aadhaar_front",
    fs.createReadStream(files.aadhaar_front[0].path)
  );
  form.append("aadhaar_back", fs.createReadStream(files.aadhaar_back[0].path));
  form.append("pan_front", fs.createReadStream(files.pan_front[0].path));

  if (files.passport?.[0]?.path) {
    form.append("passport", fs.createReadStream(files.passport[0].path));
  }

  const resp = await axios.post(config.kycServerUrl, form, {
    headers: form.getHeaders(),
    timeout: 240000,
  });

  return resp.data;
}

async function purgePreviousKyc(student) {
  const k = student.kycData || {};

  const deletions = [
    {
      publicId: k.aadhaarFrontPublicId,
      resourceType: k.aadhaarFrontResourceType,
      type: k.aadhaarFrontType,
    },
    {
      publicId: k.aadhaarBackPublicId,
      resourceType: k.aadhaarBackResourceType,
      type: k.aadhaarBackType,
    },
    {
      publicId: k.panFrontPublicId,
      resourceType: k.panFrontResourceType,
      type: k.panFrontType,
    },
    {
      publicId: k.passportPublicId,
      resourceType: k.passportResourceType,
      type: k.passportType,
    },
  ].filter((x) => x.publicId);

  await Promise.allSettled(deletions.map((d) => deleteFromCloudinary(d)));

  student.kycData = undefined;
  student.kycStatus = "pending";
  student.kycRejectedAt = null;
  student.kycVerifiedAt = null;
}

exports.submitKyc = asyncHandler(async (req, res) => {
  // auth middleware sets req.user.id [file:73]
  const userId = req.user?.id;
  if (!userId) throw new AppError("Unauthorized", 401);

  const student = await Student.findById(userId).select(
    "+kycData.aadhaarFrontPublicId +kycData.aadhaarBackPublicId +kycData.panFrontPublicId +kycData.passportPublicId " +
      "+kycData.aadhaarFrontResourceType +kycData.aadhaarBackResourceType +kycData.panFrontResourceType +kycData.passportResourceType " +
      "+kycData.aadhaarFrontType +kycData.aadhaarBackType +kycData.panFrontType +kycData.passportType " +
      "+kycData.aadhaarNumber +kycData.panNumber +kycData.passportNumber"
  );

  if (!student) throw new AppError("Student not found", 404);

  if (student.kycStatus === "verified") {
    throw new AppError("KYC already verified. Re-KYC is not allowed.", 400);
  }

  const files = req.files || {};
  for (const k of ["aadhaar_front", "aadhaar_back", "pan_front"]) {
    if (!files[k]?.[0]?.path)
      throw new AppError(`Missing required file: ${k}`, 400);
  }

  // If rejected/pending with old data -> delete old DB + cloudinary before new attempt
  if (student.kycStatus === "rejected" || student.kycStatus === "pending") {
    if (student.kycData) {
      await purgePreviousKyc(student);
      await student.save();
    }
  }

  // 1) Call python first (uses local multer files) [web:56]
  const kycResp = await callPythonKycServer(files);
  console.log("🐍 Python KYC Response:", JSON.stringify(kycResp, null, 2));

  const verified = !!kycResp.verified;
  const reasons = Array.isArray(kycResp.reasons) ? kycResp.reasons : [];

  // 2) Upload docs to cloudinary (capture url + publicId)
  const uploaded = {};
  try {
    uploaded.aadhaar_front = await uploadToCloudinary(
      files.aadhaar_front[0].path,
      {
        filename: safePublicId(userId, "aadhaar_front"),
        folder: "kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.aadhaar_back = await uploadToCloudinary(
      files.aadhaar_back[0].path,
      {
        filename: safePublicId(userId, "aadhaar_back"),
        folder: "kyc_documents",
        type: "authenticated",
      }
    );

    uploaded.pan_front = await uploadToCloudinary(files.pan_front[0].path, {
      filename: safePublicId(userId, "pan_front"),
      folder: "kyc_documents",
      type: "authenticated",
    });

    if (files.passport?.[0]?.path) {
      uploaded.passport = await uploadToCloudinary(files.passport[0].path, {
        filename: safePublicId(userId, "passport"),
        folder: "kyc_documents",
        type: "authenticated",
      });
    }
  } catch (e) {
    // best-effort cleanup of partially uploaded new docs [web:48]
    await Promise.allSettled([
      uploaded.aadhaar_front?.publicId
        ? deleteFromCloudinary({
            publicId: uploaded.aadhaar_front.publicId,
            resourceType: uploaded.aadhaar_front.resourceType,
            type: uploaded.aadhaar_front.type,
          })
        : null,
      uploaded.aadhaar_back?.publicId
        ? deleteFromCloudinary({
            publicId: uploaded.aadhaar_back.publicId,
            resourceType: uploaded.aadhaar_back.resourceType,
            type: uploaded.aadhaar_back.type,
          })
        : null,
      uploaded.pan_front?.publicId
        ? deleteFromCloudinary({
            publicId: uploaded.pan_front.publicId,
            resourceType: uploaded.pan_front.resourceType,
            type: uploaded.pan_front.type,
          })
        : null,
      uploaded.passport?.publicId
        ? deleteFromCloudinary({
            publicId: uploaded.passport.publicId,
            resourceType: uploaded.passport.resourceType,
            type: uploaded.passport.type,
          })
        : null,
    ]);
    throw new AppError(`Cloud upload failed: ${e.message}`, 500);
  }

  // 3) Save to DB (encrypt sensitive IDs) [file:67]
  const aad = aadForUser(userId);

  const aadhaarNumberPlain = kycResp?.kycData?.aadhaarNumber ?? null;
  const panNumberPlain = kycResp?.kycData?.panNumber ?? null;
  const passportNumberPlain = kycResp?.kycData?.passportNumber ?? null;

  student.kycStatus = verified ? "verified" : "rejected";
  student.kycVerifiedAt = verified ? new Date() : null;
  student.kycRejectedAt = verified ? null : new Date();

  student.kycData = {
    aadhaarFrontUrl: uploaded.aadhaar_front.url,
    aadhaarBackUrl: uploaded.aadhaar_back.url,
    panCardUrl: uploaded.pan_front.url,
    passportUrl: uploaded.passport?.url || "",

    aadhaarFrontPublicId: uploaded.aadhaar_front.publicId,
    aadhaarBackPublicId: uploaded.aadhaar_back.publicId,
    panFrontPublicId: uploaded.pan_front.publicId,
    passportPublicId: uploaded.passport?.publicId || "",

    aadhaarFrontResourceType: uploaded.aadhaar_front.resourceType,
    aadhaarBackResourceType: uploaded.aadhaar_back.resourceType,
    panFrontResourceType: uploaded.pan_front.resourceType,
    passportResourceType: uploaded.passport?.resourceType || "image",

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
    aadhaarDOB: parseDate(kycResp?.kycData?.aadhaarDOB),

    panName: kycResp?.kycData?.panName || null,
    panFatherName: kycResp?.kycData?.panFatherName || null,
    panDOB: parseDate(kycResp?.kycData?.panDOB),

    passportName: kycResp?.kycData?.passportName || null,
    passportDOB: parseDate(kycResp?.kycData?.passportDOB),

    verificationLevel: verified ? "verified" : "not_verified",
    verificationReason: reasons.join(", "),
    lastVerifiedAt: new Date(),
  };

  await student.save();

  // 4) Return decrypted only to same user [file:67]

  await updateStudentDocumentHash(userId);

  return res.status(200).json({
    status: verified ? "verified" : "not_verified",
    verified,
    reasons,
    kycData: {
      ...kycResp.kycData,
      aadhaarNumber: decryptText(student.kycData.aadhaarNumber, aad),
      panNumber: decryptText(student.kycData.panNumber, aad),
      passportNumber: decryptText(student.kycData.passportNumber, aad),
      aadhaarFrontUrl: student.kycData.aadhaarFrontUrl,
      aadhaarBackUrl: student.kycData.aadhaarBackUrl,
      panCardUrl: student.kycData.panCardUrl,
      passportUrl: student.kycData.passportUrl,
    },
  });
});

exports.getMyKyc = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Unauthorized", 401);

  const student = await Student.findById(userId).select(
    "kycStatus kycVerifiedAt kycRejectedAt " +
      "+kycData.aadhaarNumber +kycData.panNumber +kycData.passportNumber " +
      "+kycData.aadhaarFrontUrl +kycData.aadhaarBackUrl +kycData.panCardUrl +kycData.passportUrl " +
      "+kycData.aadhaarName +kycData.aadhaarGender +kycData.aadhaarAddress +kycData.aadhaarDOB " +
      "+kycData.panName +kycData.panFatherName +kycData.panDOB " +
      "+kycData.passportName +kycData.passportDOB " +
      "+kycData.verificationLevel +kycData.verificationReason +kycData.lastVerifiedAt"
  );

  if (!student) throw new AppError("Student not found", 404);

  const aad = aadForUser(userId);

  return res.json({
    kycStatus: student.kycStatus,
    kycVerifiedAt: student.kycVerifiedAt,
    kycRejectedAt: student.kycRejectedAt,
    kycData: student.kycData
      ? {
          // Decrypted sensitive data
          aadhaarNumber: decryptText(student.kycData.aadhaarNumber, aad),
          panNumber: decryptText(student.kycData.panNumber, aad),
          passportNumber: decryptText(student.kycData.passportNumber, aad),
          // Document URLs
          aadhaarFrontUrl: student.kycData.aadhaarFrontUrl,
          aadhaarBackUrl: student.kycData.aadhaarBackUrl,
          panCardUrl: student.kycData.panCardUrl,
          passportUrl: student.kycData.passportUrl,

          // Extracted Aadhaar data
          aadhaarName: student.kycData.aadhaarName,
          aadhaarGender: student.kycData.aadhaarGender,
          aadhaarAddress: student.kycData.aadhaarAddress,
          aadhaarDOB: student.kycData.aadhaarDOB,
          // Extracted PAN data
          panName: student.kycData.panName,
          panFatherName: student.kycData.panFatherName,
          panDOB: student.kycData.panDOB,
          // Extracted Passport data
          passportName: student.kycData.passportName,
          passportDOB: student.kycData.passportDOB,
          // Verification metadata
          verificationLevel: student.kycData.verificationLevel,
          verificationReason: student.kycData.verificationReason,
          lastVerifiedAt: student.kycData.lastVerifiedAt,
        }
      : null,
  });
});

exports.deleteKYC = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const student = await Student.findById(userId).select(
    "+kycData.aadhaarFrontPublicId +kycData.aadhaarBackPublicId +kycData.panFrontPublicId +kycData.passportPublicId " +
      "+kycData.aadhaarFrontResourceType +kycData.aadhaarBackResourceType +kycData.panFrontResourceType +kycData.passportResourceType " +
      "+kycData.aadhaarFrontType +kycData.aadhaarBackType +kycData.panFrontType +kycData.passportType"
  );

  if (!student) throw new AppError("Student not found", 404);

  if (student.kycData) {
    await purgePreviousKyc(student);
    await student.save();
  }

  await updateStudentDocumentHash(userId);

  res.status(200).json({ success: true, message: "KYC reset successfully" });
});
