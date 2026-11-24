import multer from 'multer';
import path from 'path';
import imageFilter from './imageFilter.js';
import { AVATAR_DIR } from '../../config/paths.js';

// Set storage engine
const storage = multer.diskStorage({
  destination: AVATAR_DIR,
  filename: function (req, file, cb) {
    cb(null, `user-${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

// Initialize upload
const avatarUpload = multer({
  storage,
  limits: { fileSize: 2000000 }, // 2MB
  fileFilter: imageFilter
});

export default avatarUpload;