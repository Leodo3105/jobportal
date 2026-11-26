import express from 'express';
import {
  createJob,
  getJobs,
  getJob,
  updateJob,
  deleteJob,
  getEmployerJobs,
  getEmployerJob,
  changeJobStatus,
  getSimilarJobs
} from '../../controllers/job/jobController.js';
import { protect, authorize } from '../../middlewares/auth.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Reject malformed ids with 400
router.param('id', validateObjectId);

// Base routes
router.route('/')
  .get(getJobs)
  .post(protect, authorize('employer', 'admin'), createJob);

router.route('/:id')
  .get(getJob)
  .put(protect, authorize('employer', 'admin'), updateJob)
  .delete(protect, authorize('employer', 'admin'), deleteJob);

// Get similar jobs
router.get('/:id/similar', getSimilarJobs);

// Get employer's jobs
router.get('/employer/myjobs', protect, authorize('employer'), getEmployerJobs);
router.get('/employer/myjobs/:id', protect, authorize('employer'), getEmployerJob);

// Change job status
router.put('/:id/status', protect, authorize('employer', 'admin'), changeJobStatus);

export default router;