// controllers/notificationController.js
const Notification = require("../models/Notification");
const { AppError, asyncHandler } = require("../middlewares/errorMiddleware");

/**
 * Helper to map req.user.role -> Notification.recipientModel
 */
function getRecipientModelFromRole(role) {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "admin" || r === "superadmin" || r === "subadmin") return "Admin";
  if (r === "student" || r === "user") return "Student";
  if (r === "nbfc") return "NBFC";
  if (r === "consultant") return "Consultant";
  return null;
}

/**
 * @desc Get notifications for current user
 * @route GET /api/notifications
 * @access Private (any authenticated role)
 * query: page, limit, isRead, type
 */
exports.getMyNotifications = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const recipientModel = getRecipientModelFromRole(req.user.role);

  if (!recipientModel) {
    throw new AppError("Unsupported role for notifications", 400);
  }

  const { page = 1, limit = 20, isRead, type } = req.query;

  const query = {
    recipient: userId,
    recipientModel,
  };

  if (typeof isRead !== "undefined") {
    if (isRead === "true" || isRead === true) query.isRead = true;
    if (isRead === "false" || isRead === false) query.isRead = false;
  }

  if (type) {
    query.type = type;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  const total = await Notification.countDocuments(query);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: notifications,
  });
});

exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get unread notification count for current user
 * @route GET /api/notifications/unread-count
 * @access Private
 */
exports.getUnreadCount = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const recipientModel = getRecipientModelFromRole(req.user.role);

  if (!recipientModel) {
    throw new AppError("Unsupported role for notifications", 400);
  }

  const count = await Notification.countDocuments({
    recipient: userId,
    recipientModel,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    unreadCount: count,
  });
});

/**
 * @desc Mark a single notification as read
 * @route PATCH /api/notifications/:id/read
 * @access Private
 */
exports.markNotificationRead = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const recipientModel = getRecipientModelFromRole(req.user.role);
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipient: userId,
      recipientModel,
    },
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  res.status(200).json({
    success: true,
    data: notification,
  });
});

/**
 * @desc Mark multiple notifications as read
 * @route PATCH /api/notifications/read-many
 * @access Private
 * body: { ids: string[] }
 */
exports.markManyRead = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const recipientModel = getRecipientModelFromRole(req.user.role);
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("ids array is required", 400);
  }

  const result = await Notification.updateMany(
    {
      _id: { $in: ids },
      recipient: userId,
      recipientModel,
    },
    {
      $set: { isRead: true, readAt: new Date() },
    }
  );

  res.status(200).json({
    success: true,
    matched: result.matchedCount || result.n || 0,
    modified: result.modifiedCount || result.nModified || 0,
  });
});

/**
 * @desc Mark all notifications as read for current user
 * @route PATCH /api/notifications/read-all
 * @access Private
 */
exports.markAllRead = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const recipientModel = getRecipientModelFromRole(req.user.role);

  if (!recipientModel) {
    throw new AppError("Unsupported role for notifications", 400);
  }

  const result = await Notification.updateMany(
    {
      recipient: userId,
      recipientModel,
      isRead: false,
    },
    {
      $set: { isRead: true, readAt: new Date() },
    }
  );

  res.status(200).json({
    success: true,
    matched: result.matchedCount || result.n || 0,
    modified: result.modifiedCount || result.nModified || 0,
  });
});
