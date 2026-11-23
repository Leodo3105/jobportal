import express from 'express';
import {
  createOrUpdateCompany,
  getCompanyProfile,
  getAllCompanies,
  getCompanyById,
  uploadLogo,
  getCompanyLogo,
  getCompanyStats
} from '../../controllers/employer/companyController.js';
import { protect, authorize } from '../../middlewares/auth.js';
import logoUpload from '../../middlewares/uploads/logoUpload.js';
import validateObjectId from '../../middlewares/validateObjectId.js';

const router = express.Router();

// Reject malformed ids with 400
router.param('id', validateObjectId);

// Base routes
router.route('/')
  .get(protect, authorize('employer'), getCompanyProfile)
  .post(protect, authorize('employer'), createOrUpdateCompany)
  .put(protect, authorize('employer'), createOrUpdateCompany);

// Get all companies
router.get('/all', getAllCompanies);

// Company statistics (must be declared before /:id)
router.get('/stats', protect, authorize('employer'), getCompanyStats);

// Get company by ID
router.get('/:id', getCompanyById);

// Upload company logo
router.put('/logo', 
  protect, 
  authorize('employer'), 
  logoUpload.single('logo'), 
  uploadLogo
);

// Get company logo
router.get('/logo/:filename', getCompanyLogo);

export default router;