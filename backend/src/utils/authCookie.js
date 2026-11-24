// Helpers for the httpOnly auth cookie used by the Next.js frontend.
export const AUTH_COOKIE = 'token';

const cookieDays = () => {
  const days = parseInt(process.env.JWT_COOKIE_DAYS, 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
};

// Cookie chỉ gửi qua HTTPS khi production. COOKIE_SECURE=false bỏ điều này, dùng khi chạy
// production qua http:// (Docker Compose trên máy, chưa có HTTPS). Deploy thật có HTTPS thì để trống.
const isSecure = () => {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
};

const baseOptions = () => ({
  httpOnly: true, // not readable from JavaScript (XSS cannot steal it)
  sameSite: 'lax', // not sent on cross-site POST/PUT/DELETE
  secure: isSecure(),
  path: '/'
});

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE, token, {
    ...baseOptions(),
    maxAge: cookieDays() * 24 * 60 * 60 * 1000
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, baseOptions());
};
