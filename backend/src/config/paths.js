import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All uploaded files live in <project root>/uploads (gitignored)
export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
export const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
export const LOGO_DIR = path.join(UPLOAD_ROOT, 'logos');
export const CV_DIR = path.join(UPLOAD_ROOT, 'cv');

// Default images (tracked in git) copied into uploads on startup
const DEFAULTS_DIR = path.resolve(__dirname, '../assets/defaults');
export const DEFAULT_AVATAR = 'default-avatar.jpg';
export const DEFAULT_LOGO = 'default-company-logo.png';

/**
 * Create upload folders and copy default images if missing.
 * Safe to call multiple times.
 */
export const ensureUploadDirs = () => {
  for (const dir of [AVATAR_DIR, LOGO_DIR, CV_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaults = [
    [DEFAULT_AVATAR, AVATAR_DIR],
    [DEFAULT_LOGO, LOGO_DIR]
  ];

  for (const [file, dir] of defaults) {
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      fs.copyFileSync(path.join(DEFAULTS_DIR, file), target);
    }
  }
};

/**
 * Resolve a user-supplied filename inside an upload folder.
 * Strips any directory parts and returns null if the result escapes `dir`.
 */
export const resolveUploadFile = (dir, filename) => {
  if (typeof filename !== 'string' || !filename) return null;

  const safeName = path.basename(filename);
  if (!safeName || safeName === '.' || safeName === '..') return null;

  const fullPath = path.resolve(dir, safeName);
  if (path.dirname(fullPath) !== path.resolve(dir)) return null;

  return fullPath;
};

/**
 * Delete an uploaded file if it exists. Ignores default images and missing files.
 */
export const removeUploadFile = (dir, filename) => {
  if (!filename || filename === DEFAULT_AVATAR || filename === DEFAULT_LOGO) return;

  const filePath = resolveUploadFile(dir, filename);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};
