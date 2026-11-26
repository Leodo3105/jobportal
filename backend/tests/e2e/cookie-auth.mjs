// Checks for "Giai đoạn 0": cookie-based auth, logout, CSRF origin check.
// Simulates a browser with a tiny cookie jar (no Authorization header).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const [BE, BASE, MONGO, SERVER_LOG] = process.argv.slice(2);
const require = createRequire(path.join(BE, 'package.json'));
const mongoose = require('mongoose');

// Ngành của công ty phải có trong danh mục. Bộ này không có admin nên ghi thẳng ngành "IT" vào DB test.
{
  const conn = await mongoose.createConnection(MONGO).asPromise();
  await conn.collection('categories').insertOne({ name: 'IT', slug: 'it', type: 'industry', active: true });
  await conn.close();
}
const FE = 'http://localhost:3000';

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};

// Minimal cookie jar: stores cookies from Set-Cookie, honours deletion
const makeJar = () => {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    store(res) {
      for (const sc of res.headers.getSetCookie()) {
        const [pair, ...attrs] = sc.split(';').map((s) => s.trim());
        const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
        const expired = attrs.some((a) => /^expires=/i.test(a) && new Date(a.slice(8)) < new Date()) ||
          attrs.some((a) => /^max-age=0$/i.test(a)) || value === '';
        expired ? jar.delete(name) : jar.set(name, value);
      }
    },
    has: (name) => jar.has(name),
    clear: () => jar.clear()
  };
};

const browser = (jar, origin = FE) => async (method, url, json) => {
  const headers = {};
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  if (origin && method !== 'GET') headers.Origin = origin;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(BASE + url, { method, headers, body, redirect: 'manual' });
  jar.store(res);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, res };
};

const P = 'Passw0rd!';
const jar = makeJar();
const b = browser(jar);

// --- register sets the cookie
const reg = await b('POST', '/api/auth/register', { name: 'Emp', email: 'emp@t.io', password: P, role: 'employer' });
const setCookie = reg.res.headers.getSetCookie().find((c) => c.startsWith('token='));
check('Đăng ký trả Set-Cookie token', reg.status === 201 && Boolean(setCookie), setCookie?.split(';')[0].slice(0, 20));
check('Cookie có HttpOnly, SameSite=Lax, Path=/',
  /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Path=\//i.test(setCookie), setCookie?.split(';').slice(1).join(';'));
check('Cookie không có Secure khi không phải production', !/;\s*Secure/i.test(setCookie));
const maxAge = Number(setCookie?.match(/Max-Age=(\d+)/i)?.[1]);
check('Cookie sống 30 ngày (mặc định)', maxAge === 30 * 24 * 3600, `Max-Age=${maxAge}`);

// --- cookie alone authenticates
const me = await b('GET', '/api/auth/me');
check('GET /auth/me chỉ bằng cookie trả 200', me.status === 200 && me.data.data?.email === 'emp@t.io', `status ${me.status}`);
const create = await b('POST', '/api/companies', { name: 'ACME', description: 'd', industry: 'IT', location: 'HN' });
check('POST bằng cookie + Origin hợp lệ thành công', create.status === 201, `status ${create.status}`);

// --- CSRF: foreign origin rejected, missing origin allowed
const evil = browser(jar, 'http://evil.example');
const csrf = await evil('PUT', '/api/companies', { name: 'Hacked', description: 'd', industry: 'IT', location: 'HN' });
check('PUT từ origin lạ bị chặn 403', csrf.status === 403, `status ${csrf.status}`);
const still = await b('GET', '/api/companies');
check('Dữ liệu không bị đổi bởi request bị chặn', still.data.data?.name === 'ACME');
const csrfLogin = await browser(makeJar(), 'http://evil.example')('POST', '/api/auth/login', { email: 'emp@t.io', password: P });
check('Đăng nhập từ origin lạ bị chặn 403', csrfLogin.status === 403, `status ${csrfLogin.status}`);
const noOrigin = await browser(jar, null)('PUT', '/api/companies', { name: 'ACME 2', description: 'd', industry: 'IT', location: 'HN' });
check('Request không có Origin (curl/script) vẫn chạy', noOrigin.status === 200, `status ${noOrigin.status}`);
const getEvil = await evil('GET', '/api/auth/me');
check('GET không bị chặn bởi kiểm tra Origin', getEvil.status === 200);

// --- logout clears cookie
const out = await b('POST', '/api/auth/logout');
check('POST /auth/logout trả 200 và xoá cookie', out.status === 200 && !jar.has('token'), `còn cookie: ${jar.has('token')}`);
const afterOut = await b('GET', '/api/auth/me');
check('Sau đăng xuất gọi /auth/me trả 401', afterOut.status === 401, `status ${afterOut.status}`);
const getLogout = await browser(makeJar(), null)('GET', '/api/auth/logout');
check('GET /auth/logout (tương thích cũ) vẫn chạy', getLogout.status === 200);

// --- login sets cookie again; Bearer still works
const login = await b('POST', '/api/auth/login', { email: 'emp@t.io', password: P });
check('Đăng nhập lại có cookie mới', login.status === 200 && jar.has('token'));
const bearer = await fetch(BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${login.data.token}` } });
check('Bearer token vẫn dùng được', bearer.status === 200);
const badCookie = await fetch(BASE + '/api/auth/me', { headers: { Cookie: 'token=abc.def.ghi' } });
check('Cookie giả trả 401', badCookie.status === 401);

// --- reset-password does NOT log in; the user logs in again with the new password
const jar2 = makeJar();
const b2 = browser(jar2);
await b2('POST', '/api/auth/register', { name: 'Seeker', email: 'js@t.io', password: P, role: 'jobseeker' });
jar2.clear();
await b2('POST', '/api/auth/forgot-password', { email: 'js@t.io' });
await new Promise((r) => setTimeout(r, 300));
const token = fs.readFileSync(SERVER_LOG, 'utf8').match(/js@t\.io: \S+token=([a-f0-9]+)/)?.[1];
const reset = await b2('POST', '/api/auth/reset-password', { token, password: 'N3wPassw0rd!' });
check('Đặt lại mật khẩu xong không set cookie đăng nhập', reset.status === 200 && !jar2.has('token') && (await b2('GET', '/api/auth/me')).status === 401, `status ${reset.status}`);
const relogin = await b2('POST', '/api/auth/login', { email: 'js@t.io', password: 'N3wPassw0rd!' });
check('Đăng nhập lại bằng mật khẩu mới thì có cookie', relogin.status === 200 && jar2.has('token'));
const link = fs.readFileSync(SERVER_LOG, 'utf8').match(/js@t\.io: (\S+)/)?.[1];
check('Link đặt lại mật khẩu trỏ về FE localhost:3000', link?.startsWith('http://localhost:3000/reset-password?token='), link?.slice(0, 45));

// --- deleting the account clears the cookie
const del = await b2('DELETE', '/api/profiles');
check('Xoá tài khoản thì cookie bị xoá', del.status === 200 && !jar2.has('token'), `status ${del.status}`);

// --- CORS with credentials
const pre = await fetch(BASE + '/api/auth/me', { method: 'OPTIONS', headers: { Origin: FE, 'Access-Control-Request-Method': 'GET' } });
check('CORS cho phép credentials với FE localhost:3000',
  pre.headers.get('access-control-allow-origin') === FE && pre.headers.get('access-control-allow-credentials') === 'true');

await mongoose.connect(MONGO);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
