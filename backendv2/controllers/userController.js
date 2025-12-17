// controllers/userController.js
const User = require("../models/students");
const cache = require("../utils/cache"); // <-- add this

// @desc Get current user profile
// @route GET /api/users/profile
// @access Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean(); // Lean for performance

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // await cache.set(cacheKey, profile, 120); // 2 minutes

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          ...(() => {
            const { _id, kycData, password, __v, ...rest } = user; // Exclude _id, kyc, password, and __v from the rest
            return rest;
          })(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update user profile (non-sensitive fields only)
// @route PUT /api/users/profile
// @access Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, profilePicture },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await cache.delByPrefix(`user:profile:${req.user._id.toString()}`);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc Change password
// @route PUT /api/users/change-password
// @access Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Current and new password (min 8 chars) are required",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent reuse
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as current",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete user account (soft delete)
// @route DELETE /api/users/account
// @access Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};
