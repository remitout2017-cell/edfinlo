// test-cloudinary.js - Run this to test your Cloudinary setup
// Usage: node test-cloudinary.js /path/to/test.pdf

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
require("dotenv").config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testCloudinaryUpload(filePath) {
  console.log("🧪 Testing Cloudinary Upload");
  console.log("=" .repeat(70));
  
  // Check environment variables
  console.log("\n1️⃣ Checking Environment Variables:");
  console.log(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}`);
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("\n❌ Cloudinary credentials missing in .env file!");
    console.log("\nAdd these to your .env:");
    console.log("CLOUDINARY_CLOUD_NAME=your_cloud_name");
    console.log("CLOUDINARY_API_KEY=your_api_key");
    console.log("CLOUDINARY_API_SECRET=your_api_secret");
    process.exit(1);
  }

  // Check file exists
  console.log(`\n2️⃣ Checking Test File:`);
  console.log(`   File path: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`   ❌ File not found!`);
    process.exit(1);
  }
  
  const stats = fs.statSync(filePath);
  console.log(`   ✅ File exists (${(stats.size / 1024).toFixed(2)} KB)`);

  // Test upload
  console.log(`\n3️⃣ Testing Upload:`);
  
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "test_uploads",
      resource_type: "raw",
      type: "authenticated",
      public_id: `test_${Date.now()}`,
    });

    console.log(`   ✅ Upload successful!`);
    console.log(`\n   Result:`);
    console.log(`   - URL: ${result.secure_url}`);
    console.log(`   - Public ID: ${result.public_id}`);
    console.log(`   - Resource Type: ${result.resource_type}`);
    console.log(`   - Format: ${result.format}`);
    console.log(`   - Size: ${(result.bytes / 1024).toFixed(2)} KB`);

    // Test what uploadToCloudinary would return
    console.log(`\n4️⃣ What your controller would receive:`);
    const mappedResult = {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      type: "authenticated",
    };
    console.log(JSON.stringify(mappedResult, null, 2));

    // Test deletion
    console.log(`\n5️⃣ Testing Deletion:`);
    const deleteResult = await cloudinary.uploader.destroy(result.public_id, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });

    console.log(`   Delete result: ${deleteResult.result}`);
    if (deleteResult.result === "ok") {
      console.log(`   ✅ Delete successful!`);
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ ALL TESTS PASSED - Cloudinary is working correctly!`);
    console.log(`${"=".repeat(70)}\n`);

  } catch (error) {
    console.error(`\n❌ Upload failed!`);
    console.error(`   Error: ${error.message}`);
    
    if (error.http_code) {
      console.error(`   HTTP Code: ${error.http_code}`);
    }
    
    if (error.message.includes("Invalid")) {
      console.error(`\n💡 Tip: Check your Cloudinary credentials are correct`);
    }
    
    if (error.message.includes("resource_type")) {
      console.error(`\n💡 Tip: Make sure 'raw' resource_type is supported in your plan`);
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`❌ TESTS FAILED - Fix Cloudinary configuration`);
    console.log(`${"=".repeat(70)}\n`);
    
    process.exit(1);
  }
}

// Run test
const testFile = process.argv[2];

if (!testFile) {
  console.error("❌ Please provide a test file path");
  console.log("\nUsage:");
  console.log("  node test-cloudinary.js /path/to/test.pdf");
  console.log("\nExample:");
  console.log("  node test-cloudinary.js ./uploads/sample.pdf");
  process.exit(1);
}

testCloudinaryUpload(testFile);