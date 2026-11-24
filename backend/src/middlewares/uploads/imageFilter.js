import path from 'path';

// Allowed image extension -> MIME types.
// SVG is intentionally excluded: it can embed scripts (stored XSS when opened directly).
const ALLOWED_IMAGES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp']
};

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_IMAGES[ext]?.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(new Error('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)!'));
};

export default imageFilter;
