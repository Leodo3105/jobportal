// Frontend origin(s) allowed to call the API, from CLIENT_URL (comma-separated).
// The first one is used to build links in emails (e.g. reset password).
const DEFAULT_CLIENT_URL = 'http://localhost:3000';

export const allowedOrigins = () =>
  (process.env.CLIENT_URL || DEFAULT_CLIENT_URL)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const primaryClientUrl = () => allowedOrigins()[0] || DEFAULT_CLIENT_URL;
