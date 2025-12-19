// services/imageService.js - FIXED VERSION

const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (make sure this is in your config or here)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} Upload result with secure_url, public_id, etc.
 */
async function uploadToCloudinary(filePath, options = {}) {
  try {
    console.log(`\n🔵 [Cloudinary] Uploading file: ${filePath}`);
    console.log(`🔵 [Cloudinary] Options:`, JSON.stringify(options, null, 2));

    // ✅ CRITICAL: Cloudinary upload returns a promise
    const result = await cloudinary.uploader.upload(filePath, {
      ...options,
      // Ensure these are set correctly
      resource_type: options.resource_type || "raw", // For PDFs
      type: options.type || "authenticated", // For authenticated access
    });

    console.log(
      `🔵 [Cloudinary] Raw result:`,
      JSON.stringify(
        {
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
        },
        null,
        2
      )
    );

    // ✅ Return the complete result object
    // Cloudinary returns: { secure_url, public_id, resource_type, format, bytes, ... }
    if (!result || !result.secure_url) {
      throw new Error("Cloudinary upload failed - no secure_url in response");
    }

    console.log(`✅ [Cloudinary] Upload successful: ${result.secure_url}`);

    return result; // Return the FULL result object
  } catch (error) {
    console.error(`❌ [Cloudinary] Upload failed:`, error);
    throw new Error(`Cloudinary upload error: ${error.message}`);
  }
}

/**
 * Delete file from Cloudinary
 * @param {object} options - { publicId, resourceType, type }
 * @returns {Promise<object>} Delete result
 */
async function deleteFromCloudinary({
  publicId,
  resourceType = "raw",
  type = "authenticated",
}) {
  try {
    console.log(`\n🗑️ [Cloudinary] Deleting: ${publicId}`);
    console.log(`   Resource type: ${resourceType}, Type: ${type}`);

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: type,
      invalidate: true, // Invalidate CDN cache
    });

    console.log(`🗑️ [Cloudinary] Delete result:`, result);

    if (result.result === "ok" || result.result === "not found") {
      console.log(`✅ [Cloudinary] Delete successful`);
      return result;
    }

    throw new Error(`Delete failed: ${result.result}`);
  } catch (error) {
    console.error(`❌ [Cloudinary] Delete failed:`, error);
    // Don't throw - deletion failures shouldn't stop the main flow
    return { result: "error", error: error.message };
  }
}

/**
 * Generate authenticated URL for private resources
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} Authenticated URL
 */
function generateAuthenticatedUrl(publicId, options = {}) {
  try {
    const url = cloudinary.url(publicId, {
      ...options,
      type: "authenticated",
      sign_url: true,
      secure: true,
    });

    return url;
  } catch (error) {
    console.error(`❌ [Cloudinary] URL generation failed:`, error);
    throw new Error(`URL generation error: ${error.message}`);
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  generateAuthenticatedUrl,
  cloudinary, // Export cloudinary instance if needed elsewhere
};
