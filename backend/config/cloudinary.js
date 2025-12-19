// config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const config = require("./config");

if (
  !config.cloudinary.cloudName ||
  !config.cloudinary.apiKey ||
  !config.cloudinary.apiSecret
) {
  throw new Error(
    "Cloudinary credentials missing in env (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)"
  );
}

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

module.exports = cloudinary;
