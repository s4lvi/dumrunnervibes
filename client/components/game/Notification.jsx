"use client";

import React, { useState, useEffect } from "react";
import audioManager from "@/lib/game/audioManager";

const Notification = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Handle notification events
    const handleDisplayNotification = (event) => {
      const { message, type = "info", duration = 3000 } = event.detail;

      // Play appropriate sound based on type
      if (type === "error") {
        audioManager.playUI("back");
      } else if (type === "success") {
        audioManager.playGameSound("wave-complete");
      } else {
        audioManager.playUI("click");
      }

      // Create notification with unique ID
      const id = Date.now();
      const newNotification = {
        id,
        message,
        type,
      };

      // Add to the list
      setNotifications((prev) => [...prev, newNotification]);

      // Remove after duration
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    };

    document.addEventListener("displayNotification", handleDisplayNotification);

    return () => {
      document.removeEventListener(
        "displayNotification",
        handleDisplayNotification
      );
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
};

export default Notification;
