import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../../controllers/notification/notificationController.js';
import { protect } from '../../middlewares/auth.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Reject malformed ids with 400
router.param('id', validateObjectId);

// Get user notifications
router.get('/', protect, getNotifications);

// Mark notification as read
router.put('/:id/read', protect, markAsRead);

// Mark all notifications as read
router.put('/read-all', protect, markAllAsRead);

// Delete notification
router.delete('/:id', protect, deleteNotification);

export default router;