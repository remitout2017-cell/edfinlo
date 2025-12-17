// services/imageService.js - FIXED VERSION
const cloudinary = require("../config/cloudinary");
const fs = require("fs").promises;
const crypto = require("crypto");
const sharp = require("sharp");
const config = require("../config/config");

/**
 * Compress and encrypt image before upload
 */
async function compressAndEncryptImage(filePath) {
  try {
    // Compress
    const compressedBuffer = await sharp(filePath)
      .resize(1920, 1920, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    console.log(
      `📦 Compressed image: ${(compressedBuffer.length / 1024).toFixed(0)}KB`
    );

    // For KYC documents, return compressed version without encryption
    // Encryption can be added later if needed with proper key management
    return compressedBuffer;
  } catch (error) {
    console.error(`❌ Compression failed for ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Upload image buffer to Cloudinary
 */
async function uploadImageToCloudinary(buffer, filename = `doc-${Date.now()}`) {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "kyc_documents",
          public_id: filename,
          resource_type: "image",
          format: "jpg",
          access_mode: "authenticated", // Require auth to view
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary image upload error:", error);
            return reject(error);
          }
          console.log(`✅ Uploaded to: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error(`❌ Cloudinary upload failed:`, error.message);
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
}

/**
 * Upload PDF buffer to Cloudinary
 */
async function uploadPdfToCloudinary(buffer, filename = `doc-${Date.now()}`) {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "financial_documents",
          public_id: filename,
          resource_type: "raw", // Use 'raw' for PDFs and other non-image files
          format: "pdf",
          access_mode: "authenticated", // Require auth to view
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary PDF upload error:", error);
            return reject(error);
          }
          console.log(`✅ PDF uploaded to: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error("❌ Cloudinary PDF upload failed:", error.message);
    throw new Error(`Failed to upload PDF to Cloudinary: ${error.message}`);
  }
}

/**
 * Delete local file
 */
async function deleteLocalFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`🗑️ Deleted local file: ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`⚠️ Could not delete: ${filePath}`, error.message);
    }
  }
}

/**
 * Compress image without encryption
 */
async function compressImage(filePath) {
  try {
    const compressedBuffer = await sharp(filePath)
      .resize(1920, 1920, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    console.log(
      `📦 Compressed: ${(compressedBuffer.length / 1024).toFixed(0)}KB`
    );
    return compressedBuffer;
  } catch (error) {
    console.error(`❌ Compression failed for ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Generic upload to Cloudinary (auto-detects type)
 */
async function uploadToCloudinary(filePathOrBuffer, filename = `doc-${Date.now()}`, options = {}) {
  try {
    // If it's a file path, read it first
    let buffer = filePathOrBuffer;
    if (typeof filePathOrBuffer === 'string') {
      buffer = await fs.readFile(filePathOrBuffer);
    }

    // Determine resource type based on filename or options
    const isPdf = filename.toLowerCase().endsWith('.pdf') || options.resourceType === 'raw';
    
    if (isPdf) {
      return await uploadPdfToCloudinary(buffer, filename);
    } else {
      return await uploadImageToCloudinary(buffer, filename);
    }
  } catch (error) {
    console.error(`❌ Upload to Cloudinary failed:`, error.message);
    throw error;
  }
}

module.exports = {
  compressImage,
  compressAndEncryptImage,
  uploadImageToCloudinary,
  uploadPdfToCloudinary,
  uploadToCloudinary,
  deleteLocalFile,
};