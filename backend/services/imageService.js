// services/imageService.js
const cloudinary = require("../config/cloudinary");
const fs = require("fs").promises;
const sharp = require("sharp");
const path = require("path");

async function deleteLocalFile(filePath) {
  try {
    if (!filePath) return;
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT")
      console.warn("⚠️ Failed to delete local file:", err.message);
  }
}

async function compressImage(filePath, options = {}) {
  const buffer = await sharp(filePath)
    .rotate()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: options.quality || 85, mozjpeg: true })
    .toBuffer();
  return buffer;
}

function uploadBufferToCloudinary({
  buffer,
  filename,
  folder,
  resourceType = "image",
  type = "authenticated",
}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename,
        resource_type: resourceType,
        type, // authenticated assets need type param to delete reliably later [web:48]
        access_mode: "authenticated",
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          type: result.type,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

async function uploadToCloudinary(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = options.filename || `doc-${Date.now()}`;
  const folder = options.folder || "kyc_documents";
  const type = options.type || "authenticated";

  try {
    if (ext === ".pdf") {
      const buffer = await fs.readFile(filePath);
      return await uploadBufferToCloudinary({
        buffer,
        filename,
        folder: options.folder || "financial_documents",
        resourceType: "raw",
        type,
      });
    }

    const compressed = await compressImage(filePath, options);
    return await uploadBufferToCloudinary({
      buffer: compressed,
      filename,
      folder,
      resourceType: "image",
      type,
    });
  } finally {
    await deleteLocalFile(filePath);
  }
}

async function deleteFromCloudinary({
  publicId,
  resourceType = "image",
  type = "authenticated",
}) {
  if (!publicId) return null;
  // destroy(public_id, options) is the standard Cloudinary delete call [web:48]
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type,
    invalidate: true,
  });
}

module.exports = {
  compressImage,
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteLocalFile,
};
