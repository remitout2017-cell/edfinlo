// queues/notificationQueue.js
const { Queue, Worker } = require("bullmq");
const { redisConnection } = require("../config/redisConnection");
const Notification = require("../models/Notification");

const QUEUE_NAME = "notifications";

const notificationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

const initNotificationWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { recipientId, recipientModel, type, title, message, data } = job.data;

      if (!recipientId || !recipientModel || !type || !title || !message) {
        throw new Error("Invalid notification job data");
      }

      await Notification.create({
        recipient: recipientId,
        recipientModel,
        type,
        title,
        message,
        data: data || {},
      });
    },
    {
      connection: redisConnection,
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Notification job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Notification job ${job?.id} failed:`, err.message);
  });

  console.log("✅ Notification worker initialized");
};

module.exports = {
  notificationQueue,
  initNotificationWorker,
};
