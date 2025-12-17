// models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        recipientModel: {
            type: String,
            enum: ["Admin", "Student", "NBFC", "Consultant"],
            required: true,
            index: true,
        },

        // High-level type for filtering
        type: {
            type: String,
            enum: [
                "USER_REGISTERED",
                "NBFC_REGISTERED",
                "NBFC_APPROVED",
                "NBFC_REJECTED",
                "STUDENT_SENT_REQUEST",
                "NBFC_APPROVED_REQUEST",
                "NBFC_REJECTED_REQUEST",
                "STUDENT_ACCEPTED_OFFER",
            ],
            required: true,
            index: true,
        },

        title: { type: String, required: true },
        message: { type: String, required: true },

        // Extra context for UI
        data: {
            type: Object,
            default: {},
        },

        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: Date,
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
