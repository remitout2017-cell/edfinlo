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

function aadForUser(userId) {
  return String(userId);
}

function safePublicId(userId, docKey) {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `student_${userId}/${docKey}_${Date.now()}_${rnd}`;
}

async function sendacademicDataToServer(academicData){}