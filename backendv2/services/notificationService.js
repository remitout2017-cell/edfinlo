const { notificationQueue } = require("../queues/notificationQueue");


/**
 * Enqueue a notification to be processed by BullMQ worker.
 *
 * @param {Object} params
 * @param {String} params.recipientId - Mongo ObjectId string
 * @param {('Admin'|'Student'|'NBFC'|'Consultant')} params.recipientModel
 * @param {String} params.type - business event type
 * @param {String} params.title
 * @param {String} params.message
 * @param {Object} [params.data] - extra metadata for UI
 */



async function enqueueNotification({
    recipientId,
    recipientModel,
    type,
    title,
    message,
    data = {},
}) {    
    return notificationQueue.add("send-notification", {
        recipientId,
        recipientModel,
        type,
        title,
        message,
        data,
    });
}

module.exports = {
    enqueueNotification,
};