import { allowedOrigins } from '../config/origins.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-based auth.
 *
 * Browsers always send an Origin header on cross-site (and same-origin fetch)
 * POST/PUT/PATCH/DELETE requests. If it is present and is not one of our
 * frontend origins, the request is rejected. Requests without Origin
 * (curl, scripts, server-to-server) are allowed — they cannot carry a
 * victim's browser cookie anyway.
 */
const checkOrigin = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin || allowedOrigins().includes(origin.replace(/\/$/, ''))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Nguồn gửi yêu cầu không được phép'
  });
};

export default checkOrigin;
