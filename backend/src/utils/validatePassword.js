/**
 * Check password strength. Returns an error message, or null when valid.
 * Used by register and reset-password so both apply the same rules.
 */
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 chữ hoa';
  }
  if (!/\d/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 số';
  }
  if (!/[@$!%*?&#]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (@, $, !, %, *, ?, &, #)';
  }
  return null;
};

export default validatePassword;
