// Helpers for the httpOnly auth cookie used by the Next.js frontend.
export const AUTH_COOKIE = 'token';

const cookieDays = () => {
  const days = parseInt(process.env.JWT_COOKIE_DAYS, 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
};

const baseOptions = () => ({
  httpOnly: true, // not readable from JavaScript (XSS cannot steal it)
  sameSite: 'lax', // not sent on cross-site POST/PUT/DELETE
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
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
