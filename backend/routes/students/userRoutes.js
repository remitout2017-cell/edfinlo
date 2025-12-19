const express = require("express");
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require("../../controllers/students/userController");
const authMiddleware = require("../../middleware/authMiddleware");
const authorize = require("../../middleware/authorize");

const router = express.Router();

router.use(authMiddleware);
router.use(authorize("student"));

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.delete("/account", deleteAccount);

module.exports = router;
