import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AUTH_COOKIE } from '../utils/authCookie.js';

// Protect routes
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token (scripts, mobile, server-to-server)
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.[AUTH_COOKIE]) {
    // Set token from the httpOnly cookie (browser / Next.js frontend)
    token = req.cookies[AUTH_COOKIE];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Không có quyền truy cập'
    });
  }

  let user;
  let decoded;
  try {
    // Verify token
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    user = await User.findById(decoded.id);
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Không có quyền truy cập'
    });
  }

  // Token is valid but the account no longer exists
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Tài khoản không tồn tại hoặc đã bị xóa'
    });
  }

  // Tài khoản bị admin khoá (tài khoản cũ chưa có field này coi như đang hoạt động)
  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      error: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.'
    });
  }

  // Token cấp trước lần đổi/đặt lại mật khẩu gần nhất thì không còn hợp lệ.
  // Token cũ không có `v` được coi là phiên bản 0 (để không đăng xuất mọi người khi nâng cấp).
  if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
    return res.status(401).json({
      success: false,
      error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
    });
  }

  req.user = user;

  // Called outside try/catch so errors in later handlers are not turned into 401
  next();
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Người dùng với vai trò ${req.user.role} không có quyền truy cập vào route này`
      });
    }
    next();
  };
};
