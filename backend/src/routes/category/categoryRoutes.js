import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from '../../controllers/category/categoryController.js';
import { protect, authorize } from '../../middlewares/auth.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Reject malformed ids with 400
router.param('id', validateObjectId);

// Base routes
router.route('/')
  .get(getCategories)
  .post(protect, authorize('admin'), createCategory);

router.route('/:id')
  .get(getCategoryById)
  .put(protect, authorize('admin'), updateCategory)
  .delete(protect, authorize('admin'), deleteCategory);

// Get categories by type
router.get('/type/:type', getCategories);

export default router;