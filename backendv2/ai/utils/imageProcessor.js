// Image Optimization & Compression for AI Models
import sharp from "sharp";
import { readFile, stat } from "fs/promises";
import path from "path";

/**
 * Optimize single image for AI processing
 */
export async function optimizeImage(filePath, options = {}) {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 85,
  } = options;

  try {
    const stats = await stat(filePath);
    const fileSize = stats.size;

    // If already small enough, return as-is
    if (fileSize <= 500 * 1024) {
      const buffer = await readFile(filePath);
      const base64 = buffer.toString("base64");
      const mimeType = getMimeType(filePath);

      return {
        buffer,
        base64,
        mimeType,
        originalSize: fileSize,
        optimizedSize: fileSize,
        reduction: 0,
      };
    }

    // Optimize large images
    const optimized = await sharp(filePath)
      .resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const optimizedSize = optimized.length;
    const reduction = ((1 - optimizedSize / fileSize) * 100).toFixed(1);

    console.log(
      `📉 Image optimized: ${(fileSize / 1024).toFixed(0)}KB → ${(
        optimizedSize / 1024
      ).toFixed(0)}KB (${reduction}% reduction)`
    );

    if (optimizedSize > maxSize) {
      throw new Error(
        `Image too large after optimization: ${(
          optimizedSize /
          1024 /
          1024
        ).toFixed(1)}MB (max: ${(maxSize / 1024 / 1024).toFixed(1)}MB)`
      );
    }

    return {
      buffer: optimized,
      base64: optimized.toString("base64"),
      mimeType: "image/jpeg",
      originalSize: fileSize,
      optimizedSize,
      reduction: parseFloat(reduction),
    };
  } catch (error) {
    console.error(
      `❌ Image optimization failed for ${filePath}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Optimize multiple images in parallel
 */
export async function optimizeImages(filePaths, options = {}) {
  const { concurrency = 3 } = options;

  console.log(`📸 Optimizing ${filePaths.length} images...`);

  const results = [];

  // Process in batches to avoid overwhelming system
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((fp) => optimizeImage(fp, options))
    );
    results.push(...batchResults);
  }

  console.log(`✅ Optimized ${results.length} images`);
  return results;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "image/jpeg";
}

/**
 * Convert image to base64 data URL
 */
export function toDataURL(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Validate image file
 */
export async function validateImageFile(filePath) {
  try {
    const stats = await stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(
          ", "
        )}`
      );
    }

    if (stats.size > 20 * 1024 * 1024) {
      throw new Error(
        `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: 20MB)`
      );
    }

    return true;
  } catch (error) {
    console.error(`❌ Image validation failed:`, error.message);
    throw error;
  }
}
