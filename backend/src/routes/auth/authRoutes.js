import express from 'express';
import {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  logout,
  forgotPassword,
  resetPassword
} from '../../controllers/auth/authController.js';
import { protect } from '../../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/password', protect, changePassword);
router.post('/logout', logout);
router.get('/logout', logout); // kept for backward compatibility
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;