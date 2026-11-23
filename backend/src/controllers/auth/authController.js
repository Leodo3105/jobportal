import crypto from 'crypto';
import User from '../../models/User.js';
import validatePassword from '../../utils/validatePassword.js';
import sendEmail from '../../utils/sendEmail.js';
import { setAuthCookie, clearAuthCookie } from '../../utils/authCookie.js';
import { primaryClientUrl } from '../../config/origins.js';

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// First origin in CLIENT_URL is where the frontend lives
const clientUrl = primaryClientUrl;

// Get token from model, set the httpOnly auth cookie and send response
const sendTokenResponse = (user, statusCode, res, extra = {}) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Browser clients (Next.js) use the cookie; the token stays in the body
  // for non-browser clients and scripts that send it as a Bearer header
  setAuthCookie(res, token);

  // Prepare user data (without sensitive info)
  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    avatarUrl: `/uploads/avatars/${user.avatar}`
  };

  res.status(statusCode).json({
    success: true,
    token,
    user: userData,
    ...extra
  });
};

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if required fields exist
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ thông tin: name, email, password, role'
      });
    }

    // Body JSON có thể chứa object ({ "$ne": null }): đưa vào findOne là NoSQL injection
    if (typeof email !== 'string' || typeof name !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu đăng ký không hợp lệ'
      });
    }

    // Only public roles can self-register; admins are created via scripts/createAdmin.js
    if (!['jobseeker', 'employer'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Vai trò không hợp lệ (chỉ chấp nhận jobseeker hoặc employer)'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Email đã được sử dụng'
      });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password. Phải là chuỗi: body JSON có thể gửi
    // { "email": { "$regex": "^admin" } } để MongoDB tự tìm tài khoản thay kẻ tấn công.
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Thông tin đăng nhập không hợp lệ'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Thông tin đăng nhập không hợp lệ'
      });
    }

    // Chỉ báo "bị khoá" sau khi mật khẩu đúng, để không lộ tài khoản nào bị khoá cho người lạ
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get current logged in user
// Thông tin tài khoản trả cho FE (không có mật khẩu, token đặt lại mật khẩu, tokenVersion)
const accountData = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  avatar: user.avatar,
  avatarUrl: `/uploads/avatars/${user.avatar}`,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const getMe = async (req, res) => {
  // protect đã tìm user và gắn vào req.user
  res.status(200).json({
    success: true,
    data: accountData(req.user)
  });
};

// Số điện thoại: chữ số, dấu cách, + ( ) . -, có ít nhất 8 chữ số
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

// Đổi tên và số điện thoại. Email và vai trò KHÔNG đổi ở đây.
export const updateMe = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên' });
    }
    if (name.trim().length > 50) {
      return res.status(400).json({ success: false, error: 'Tên tối đa 50 ký tự' });
    }

    let cleanPhone = '';
    if (phone !== undefined && phone !== null && phone !== '') {
      if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim()) || (phone.match(/\d/g) ?? []).length < 8) {
        return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ' });
      }
      cleanPhone = phone.trim();
    }

    req.user.name = name.trim();
    req.user.phone = cleanPhone;
    await req.user.save();

    res.status(200).json({
      success: true,
      data: accountData(req.user),
      message: 'Đã cập nhật thông tin tài khoản'
    });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// Đổi mật khẩu khi đang đăng nhập: phải nhập đúng mật khẩu hiện tại.
// Đổi xong thì mọi phiên đăng nhập khác hết hiệu lực (tăng tokenVersion);
// phiên hiện tại nhận cookie/token mới nên không bị đăng xuất.
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    // password có select: false nên phải lấy riêng
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không đúng' });
    }
    if (await user.matchPassword(newPassword)) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }

    user.password = newPassword; // hook pre('save') sẽ băm
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    sendTokenResponse(user, 200, res, {
      message: 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// Same reply whether or not the email exists, so the endpoint
// cannot be used to find out which emails are registered
const FORGOT_PASSWORD_MESSAGE =
  'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu';

const escapeHtml = (text = '') =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Request a password reset link
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập email'
      });
    }

    const user = await User.findOne({ email: email.trim() });

    if (!user) {
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
    }

    // Only the hash is stored; the raw token is sent to the user
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpire = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const resetUrl = `${clientUrl()}/reset-password?token=${resetToken}`;

    if (!process.env.SMTP_HOST) {
      if (process.env.NODE_ENV === 'production') {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return res.status(500).json({
          success: false,
          error: 'Không gửi được email đặt lại mật khẩu'
        });
      }

      // Development without SMTP: print the link so it can be opened manually
      console.log(`[forgot-password] Link đặt lại mật khẩu cho ${user.email}: ${resetUrl}`);
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
    }

    try {
      await sendEmail({
        email: user.email,
        subject: 'Đặt lại mật khẩu JobPortal',
        message:
          `Xin chào ${user.name},\n\n` +
          `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản JobPortal.\n` +
          `Mở liên kết sau trong vòng 15 phút để đặt mật khẩu mới:\n${resetUrl}\n\n` +
          `Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html:
          `<p>Xin chào ${escapeHtml(user.name)},</p>` +
          `<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản JobPortal.</p>` +
          `<p><a href="${resetUrl}">Bấm vào đây để đặt mật khẩu mới</a> (liên kết có hiệu lực 15 phút).</p>` +
          `<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
      });
    } catch (mailError) {
      console.error('Forgot password email error:', mailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({
        success: false,
        error: 'Không gửi được email đặt lại mật khẩu'
      });
    }

    res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Set a new password using the token from the reset link
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp token và mật khẩu mới'
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError
      });
    }

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpire: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'
      });
    }

    // Hashed by the pre-save hook
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    // Ai đó có thể đã chiếm tài khoản: mọi phiên đăng nhập cũ hết hiệu lực
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    // Không đăng nhập luôn: người dùng quay về trang đăng nhập và nhập mật khẩu mới,
    // vừa để xác nhận họ nhớ mật khẩu mới, vừa không cấp phiên chỉ dựa vào link trong email.
    res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Log user out / clear cookie
export const logout = async (req, res) => {
  // JWTs are stateless: logging out removes the cookie from the browser
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    data: {},
    message: 'Đã đăng xuất'
  });
};