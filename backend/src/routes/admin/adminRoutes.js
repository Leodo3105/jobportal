import express from 'express';
import {
  listUsers,
  setUserStatus,
  deleteUser,
  listJobs,
  setJobFeatured,
  listCompanies,
  setCompanySubscription,
  listCategories
} from '../../controllers/admin/adminController.js';
import { protect, authorize } from '../../middlewares/auth.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Mọi route ở đây chỉ dành cho admin
router.use(protect, authorize('admin'));

// Id sai định dạng trả 400
router.param('id', validateObjectId);

router.get('/users', listUsers);
router.put('/users/:id/status', setUserStatus);
router.delete('/users/:id', deleteUser);

// Đổi trạng thái và xoá tin dùng route có sẵn: PUT /api/jobs/:id/status, DELETE /api/jobs/:id
router.get('/jobs', listJobs);
router.put('/jobs/:id/featured', setJobFeatured);

router.get('/companies', listCompanies);
router.put('/companies/:id/subscription', setCompanySubscription);

// Tạo/sửa/xoá danh mục dùng route có sẵn /api/categories
router.get('/categories', listCategories);

export default router;
