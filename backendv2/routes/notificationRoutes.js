// routes/notificationRoutes.js
const express = require("express");
const { body, query } = require("express-validator");
const { protect } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validationMiddleware");
const {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markManyRead,
  markAllRead,
  deleteNotification, // ✅ ADD this import
} = require("../controllers/notificationController");

const router = express.Router();

// All notification routes require authentication
router.use(protect);

// List notifications for current user
router.get(
  "/",
  query("isRead").optional().isIn(["true", "false"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  validate,
  getMyNotifications
);

// Unread count
router.get("/unread-count", getUnreadCount);

// Mark single notification as read
router.patch("/:id/read", markNotificationRead);

// Mark many as read
router.patch(
  "/read-many",
  body("ids")
    .isArray({ min: 1 })
    .withMessage("ids must be a non-empty array"),
  body("ids.*").isMongoId().withMessage("Each id must be a valid ObjectId"),
  validate,
  markManyRead
);

// Mark all as read
router.patch("/read-all", markAllRead);

// ✅ ADD: Delete single notification
router.delete("/:id", deleteNotification);

module.exports = router;
