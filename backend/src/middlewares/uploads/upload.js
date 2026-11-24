import multer from 'multer';
import path from 'path';
import { CV_DIR } from '../../config/paths.js';

// Set storage engine
const storage = multer.diskStorage({
  destination: CV_DIR,
  filename: function (req, file, cb) {
    cb(null, `cv-${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

// Check file type
const fileFilter = (req, file, cb) => {
  // Allowed extension -> MIME type
  // (.doc is "application/msword", which the old /pdf|doc|docx/ regex rejected)
  const allowed = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed[ext] && allowed[ext] === file.mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file PDF, DOC, hoặc DOCX!'));
  }
};

// Initialize upload
const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB
  fileFilter
});

export default upload;