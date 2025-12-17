// src/context/NotificationContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import { notificationAPI } from "../services/api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);

      const response = await notificationAPI.getAll(1, 20);

      // Backend can return different shapes; normalize here
      const root = response.data || {};
      const data = root.data || root;

      // Try to extract notifications array in a robust way
      let notificationsArray = [];

      if (Array.isArray(data.notifications)) {
        notificationsArray = data.notifications;
      } else if (Array.isArray(data.items)) {
        // in case backend uses "items"
        notificationsArray = data.items;
      } else if (Array.isArray(data)) {
        // directly an array
        notificationsArray = data;
      } else if (Array.isArray(root.notifications)) {
        notificationsArray = root.notifications;
      }

      // Try to extract unread count from common places
      let unread = 0;
      if (typeof data.unreadCount === "number") {
        unread = data.unreadCount;
      } else if (typeof root.unreadCount === "number") {
        unread = root.unreadCount;
      } else if (data.meta && typeof data.meta.unreadCount === "number") {
        unread = data.meta.unreadCount;
      }

      setNotifications(notificationsArray);
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === id ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      await notificationAPI.deleteNotification(id);

      setNotifications((prev) => prev.filter((notif) => notif._id !== id));

      // Decrease unread count if deleted notification was unread
      setUnreadCount((prevCount) => {
        const deletedNotif = notifications.find((n) => n._id === id);
        if (deletedNotif && !deletedNotif.read) {
          return Math.max(0, prevCount - 1);
        }
        return prevCount;
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
