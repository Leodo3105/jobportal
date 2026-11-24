import multer from 'multer';
import path from 'path';
import imageFilter from './imageFilter.js';
import { LOGO_DIR } from '../../config/paths.js';

// Set storage engine
const storage = multer.diskStorage({
  destination: LOGO_DIR,
  filename: function (req, file, cb) {
    cb(null, `company-${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

// Initialize upload
const logoUpload = multer({
  storage,
  limits: { fileSize: 2000000 }, // 2MB
  fileFilter: imageFilter
});

export default logoUpload;