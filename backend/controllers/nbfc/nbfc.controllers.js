import { asyncHandler } from "../../middleware/errorMiddleware";

const NBFC = require("../../models/nbfc/NBFC");
const generateToken = require("../../utils/generateToken");
const config = require("../../config/config");
const isDevelopment = config.env === "development";

exports.registerNBFC = asyncHandler(async (req, res) => {
  try {
    const { companyName, email, password, phoneNumber } = req.body;

    if (!companyName || !email || !password || !phoneNumber) {
      throw new Error("All fields are required");
    }
    const existingNBFC = await NBFC.findOne({
      $or: [
        { email },
        { companyName },
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    });
    if (existingNBFC) {
      let message = "NBFC already exists";
      if (existingNBFC.email === email) {
        message = "Email already registered";
      } else if (existingNBFC.companyName === companyName) {
        message = "Company name already registered";
      } else if (existingNBFC.phoneNumber === phoneNumber) {
        message = "Phone number already registered";
      }
      return res.status(400).json({
        success: false,
        message,
      });
    }
    const nbfc = await NBFC.create({
      companyName,
      email,
      password,
      phoneNumber,
    });
    return res.status(201).json({
      success: true,
      message: "NBFC registered successfully",
      nbfc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.loginNBFC = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new Error("All fields are required");
    }
    const nbfc = await NBFC.findOne({ email });
    if (!nbfc) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const isMatch = await nbfc.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    // Update last login
    nbfc.lastLogin = Date.now();
    await nbfc.save();
    const token = generateToken(nbfc._id, "NBFC");

    return res.status(200).json({
      success: true,
      token,
      message: "NBFC logged in successfully",
      nbfc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.getNBFCProfile = asyncHandler(async (req, res) => {
  try {
    const nbfc = await NBFC.findById(req.user.id);
    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "NBFC profile retrieved successfully",
      nbfc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.logoutNBFC = asyncHandler(async (req, res) => {
  try {
    res.cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    return res.status(200).json({
      success: true,
      message: "NBFC logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

exports.deleteNBFC = asyncHandler(async (req, res) => {
  try {
    const nbfc = await NBFC.findByIdAndDelete(req.user.id);
    if (!nbfc) {
      return res.status(404).json({
        success: false,
        message: "NBFC not found",
      });
    }

    res.cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    return res.status(200).json({
      success: true,
      message: "NBFC account deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
