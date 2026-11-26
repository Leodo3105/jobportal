import express from 'express';
import {
  getCurrentProfile,
  createOrUpdateProfile,
  addEducation,
  updateEducation,
  deleteEducation,
  addExperience,
  updateExperience,
  deleteExperience,
  getAllProfiles,
  getProfileById,
  uploadAvatar,
  resetAvatar,
  getAvatar
} from '../../controllers/jobseeker/profileController.js';
import { protect, authorize } from '../../middlewares/auth.js';
import avatarUpload from '../../middlewares/uploads/avatarUpload.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Reject malformed ids with 400
router.param('user_id', validateObjectId);
router.param('edu_id', validateObjectId);
router.param('exp_id', validateObjectId);

// Base route - /api/profiles
router.route('/')
  .get(protect, getCurrentProfile)
  .post(protect, authorize('jobseeker'), createOrUpdateProfile)
  .put(protect, authorize('jobseeker'), createOrUpdateProfile);
// Xoá tài khoản: DELETE /api/auth/me (bắt nhập mật khẩu). DELETE /api/profiles cũ đã bỏ.

// Candidate profiles: only for logged-in employers/admins (owner may view their own)
router.get('/all', protect, authorize('employer', 'admin'), getAllProfiles);
router.get('/user/:user_id', protect, getProfileById);

router.route('/education')
  .put(protect, authorize('jobseeker'), addEducation);

router.route('/education/:edu_id')
  .put(protect, authorize('jobseeker'), updateEducation)
  .delete(protect, authorize('jobseeker'), deleteEducation);

router.route('/experience')
  .put(protect, authorize('jobseeker'), addExperience);

router.route('/experience/:exp_id')
  .put(protect, authorize('jobseeker'), updateExperience)
  .delete(protect, authorize('jobseeker'), deleteExperience);

// Upload avatar
// Avatar works for every role (jobseeker, employer, admin)
router.put('/avatar', protect, avatarUpload.single('avatar'), uploadAvatar);

// Reset avatar to default
router.delete('/avatar', protect, resetAvatar);

// Get avatar
router.get('/avatar/:filename', getAvatar);

export default router;