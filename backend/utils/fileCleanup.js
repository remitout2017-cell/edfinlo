// utils/fileCleanup.js - ENHANCED VERSION
const fs = require("fs");
const path = require("path");
const fsPromises = fs.promises;

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MAX_AGE_MINUTES = 60; // Delete files older than 1 hour
const MAX_DIR_SIZE_MB = 1024; // Max 1GB for temp directory

/**
 * Clean up old temporary files
 */
async function cleanupOldTempFiles() {
  try {
    console.log(
      `🕒 [${new Date().toISOString()}] Starting temp file cleanup...`
    );

    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log("📁 Uploads directory does not exist, creating...");
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      return { deleted: 0, errors: 0, message: "Directory created" };
    }

    const files = await fsPromises.readdir(UPLOADS_DIR);
    let deletedCount = 0;
    let errorCount = 0;
    let totalSizeFreed = 0;
    const now = Date.now();

    console.log(`📊 Found ${files.length} files in uploads directory`);

    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);

      try {
        const stats = await fsPromises.stat(filePath);
        const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Delete if file is older than MAX_AGE_MINUTES
        if (ageMinutes > MAX_AGE_MINUTES) {
          if (stats.isFile()) {
            await fsPromises.unlink(filePath);
            deletedCount++;
            totalSizeFreed += stats.size;

            console.log(
              `🗑️ Deleted: ${file} (${ageMinutes.toFixed(
                0
              )}m old, ${fileSizeMB.toFixed(2)}MB)`
            );
          } else if (stats.isDirectory()) {
            // For directories, we might want to use rm recursive, but for now let's skip to avoid EPERM
            // or maybe recursively delete if it's old?
            // Safest is to skip regular unlink.
            // If aggressive cleanup is needed, we can use fsPromises.rm(filePath, { recursive: true, force: true })
            // But let's just avoid the crash first.
            // console.log(`Skipping directory: ${file}`);
          }
        }
      } catch (err) {
        errorCount++;
        console.error(`⚠️ Error processing ${file}:`, err.message);
      }
    }

    // Optional: Check directory size and force cleanup if too large
    const dirStats = await getDirectorySize(UPLOADS_DIR);
    const dirSizeMB = dirStats.size / (1024 * 1024);

    if (dirSizeMB > MAX_DIR_SIZE_MB) {
      console.warn(`⚠️ Uploads directory too large: ${dirSizeMB.toFixed(2)}MB`);
      await emergencyCleanup();
    }

    const result = {
      timestamp: new Date().toISOString(),
      deleted: deletedCount,
      errors: errorCount,
      sizeFreedMB: (totalSizeFreed / (1024 * 1024)).toFixed(2),
      currentDirSizeMB: dirSizeMB.toFixed(2),
      message: `Cleanup completed: ${deletedCount} files deleted, ${errorCount} errors`,
    };

    console.log(`✅ Cleanup completed:`, result);
    return result;
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    return {
      timestamp: new Date().toISOString(),
      deleted: 0,
      errors: 1,
      message: `Cleanup failed: ${error.message}`,
    };
  }
}

/**
 * Get total size of directory
 */
async function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;

  try {
    const files = await fsPromises.readdir(dirPath);

    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const stats = await fsPromises.stat(filePath);

        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        }
      } catch (err) {
        // Skip files with errors
      }
    }
  } catch (err) {
    // Directory might not exist
  }

  return { size: totalSize, files: fileCount };
}

/**
 * Emergency cleanup - delete all files regardless of age
 */
async function emergencyCleanup() {
  console.log("🚨 Performing emergency cleanup!");

  try {
    const files = await fsPromises.readdir(UPLOADS_DIR);
    let deleted = 0;

    for (const file of files) {
      try {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = await fsPromises.stat(filePath);

        if (stats.isFile()) {
          await fsPromises.unlink(filePath);
          deleted++;
          console.log(`🚨 Emergency delete: ${file}`);
        }
      } catch (err) {
        console.error(`🚨 Failed emergency delete for ${file}:`, err.message);
      }
    }

    return { emergency: true, deleted };
  } catch (error) {
    console.error("🚨 Emergency cleanup failed:", error);
    return { emergency: true, deleted: 0, error: error.message };
  }
}

/**
 * Clean up specific file immediately
 */
async function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
      console.log(`🗑️ Immediate cleanup: ${path.basename(filePath)}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`⚠️ Immediate cleanup failed for ${filePath}:`, err.message);
    return false;
  }
}

module.exports = {
  cleanupOldTempFiles,
  getDirectorySize,
  emergencyCleanup,
  cleanupFile,
};
