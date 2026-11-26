// End-to-end checks for "Bước 3" (security) against a running server on a throwaway DB.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const [BE, BASE, MONGO] = process.argv.slice(2);
const require = createRequire(path.join(BE, 'package.json'));
const mongoose = require('mongoose');

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const api = async (method, url, { token, json, form, headers: h = {} } = {}) => {
  const headers = { ...h };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + url, { method, headers, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
};
const fileForm = (field, name, type, bytes) => {
  const f = new FormData();
  f.append(field, new Blob([bytes], { type }), name);
  return f;
};

const preexisting = new Set(
  ['cv', 'logos', 'avatars'].flatMap((d) => fs.readdirSync(path.join(BE, 'uploads', d)).map((f) => `${d}/${f}`))
);
const P = 'Passw0rd!';
const register = (name, role) => api('POST', '/api/auth/register', { json: { name, email: `${name}@t.io`, password: P, role } });

// 1. role restrictions
const asAdmin = await register('hacker', 'admin');
check('Đăng ký role=admin bị từ chối', asAdmin.status === 400, `status ${asAdmin.status}`);
const asWeird = await register('weird', 'superuser');
check('Đăng ký role lạ bị từ chối', asWeird.status === 400, `status ${asWeird.status}`);

const E = (await register('emp', 'employer')).data.token;
const E2 = (await register('emp2', 'employer')).data.token;
const J = (await register('seeker', 'jobseeker')).data.token;
const J2 = (await register('seeker2', 'jobseeker')).data.token;

// createAdmin script
execFileSync('node', ['scripts/createAdmin.js', 'admin@t.io', P, 'Boss'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO } });
const adminLogin = await api('POST', '/api/auth/login', { json: { email: 'admin@t.io', password: P } });
check('Script create-admin tạo được admin', adminLogin.status === 200 && adminLogin.data.user?.role === 'admin', `status ${adminLogin.status}, role ${adminLogin.data.user?.role}`);
const A = adminLogin.data.token;
await api('POST', '/api/categories', { token: A, json: { name: 'IT', type: 'industry' } }); // ngành cho công ty/tin

// 6. company featured cannot be self-set
const comp = await api('POST', '/api/companies', { token: E, json: { name: 'ACME', description: 'd', industry: 'IT', location: 'HN', featured: true } });
check('NTD không tự đặt featured', comp.status === 201 && comp.data.data?.featured === false, `featured ${comp.data.data?.featured}`);
await api('POST', '/api/companies', { token: E2, json: { name: 'Other', description: 'd', industry: 'IT', location: 'HN' } });

// 4. logo/avatar filters
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const svgUp = await api('PUT', '/api/companies/logo', { token: E, form: fileForm('logo', 'x.svg', 'image/svg+xml', svg) });
check('Upload logo SVG bị từ chối', svgUp.status === 400, `status ${svgUp.status}`);
const png = fs.readFileSync(path.join(BE, 'src/assets/defaults/default-company-logo.png'));
const pngUp = await api('PUT', '/api/companies/logo', { token: E, form: fileForm('logo', 'l.PNG', 'image/png', png) });
check('Upload logo PNG vẫn được', pngUp.status === 200, `status ${pngUp.status}`);
const fakeAv = await api('PUT', '/api/profiles/avatar', { token: J, form: fileForm('avatar', 'a.jpg', 'text/html', Buffer.from('<h1>x</h1>')) });
check('Avatar sai mimetype bị từ chối', fakeAv.status === 400, `status ${fakeAv.status}`);

// 2. CV access control
await api('POST', '/api/profiles', { token: J, json: { title: 'Dev' } });
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
const cv = (await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'cv.pdf', 'application/pdf', pdf) })).data.data;
check('Upload CV trả đường dẫn /api/cv/...', cv?.filePath === `/api/cv/${cv?.fileName}`, cv?.filePath);
const cvUrl = `/api/cv/${cv.fileName}`;
const st = async (token) => (await api('GET', cvUrl, { token })).status;
check('Chủ CV tải được', (await st(J)) === 200);
check('Ứng viên khác không tải được (403)', (await st(J2)) === 403, `status ${await st(J2)}`);
check('NTD chưa nhận đơn không tải được (403)', (await st(E)) === 403, `status ${await st(E)}`);
check('Admin tải được', (await st(A)) === 200);
check('Không đăng nhập thì 401', (await st(null)) === 401);

const jobBody = { title: 'Dev', description: 'd', requirements: 'r', benefits: 'b', location: 'Hà Nội', jobType: 'full-time', category: 'IT', applicationDeadline: '2030-01-01' };
const jobId = (await api('POST', '/api/jobs', { token: E, json: jobBody })).data.data._id;
await api('POST', '/api/applications/apply', { token: J, json: { jobId } });
check('NTD nhận đơn thì tải được CV', (await st(E)) === 200);
check('NTD khác vẫn không tải được', (await st(E2)) === 403);

const staticCv = await api('GET', `/uploads/cv/${cv.fileName}`);
check('CV không còn tải công khai qua /uploads/cv', staticCv.status === 404, `status ${staticCv.status}`);
const trav = await api('GET', '/api/cv/..%2F..%2Fpackage.json', { token: A });
check('Path traversal qua /api/cv bị chặn', trav.status === 404, `status ${trav.status}`);

// 5. jobs listing
const draftId = (await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Secret draft' } })).data.data._id;
await api('PUT', `/api/jobs/${draftId}/status`, { token: E, json: { status: 'draft' } });
const asDraft = await api('GET', '/api/jobs?status=draft');
const leaked = JSON.stringify(asDraft.data).includes('Secret draft');
check('?status=draft không lộ tin nháp', asDraft.status === 200 && !leaked, `count ${asDraft.data.count}`);
const draftDetail = await api('GET', `/api/jobs/${draftId}`);
check('Xem chi tiết tin nháp trả 404', draftDetail.status === 404, `status ${draftDetail.status}`);
const draftSimilar = await api('GET', `/api/jobs/${draftId}/similar`);
check('Việc tương tự của tin nháp trả 404', draftSimilar.status === 404, `status ${draftSimilar.status}`);
const badRegex = await api('GET', '/api/jobs?location=' + encodeURIComponent('(['));
check('location có ký tự regex không gây lỗi', badRegex.status === 200, `status ${badRegex.status}`);
const vn = await api('GET', '/api/jobs?location=' + encodeURIComponent('hà nội'));
check('Tìm location tiếng Việt vẫn đúng', vn.data.count === 1, `count ${vn.data.count}`);
const big = await api('GET', '/api/jobs?limit=100000');
check('limit bị giới hạn 50', big.status === 200 && big.data.totalPages === 1 && big.data.pagination?.next === undefined, `status ${big.status}`);

// 7. headers, CORS
const root = await api('GET', '/');
check('Helmet: có header X-Content-Type-Options', root.headers.get('x-content-type-options') === 'nosniff');
const img = await api('GET', '/uploads/avatars/default-avatar.jpg');
check('Ảnh /uploads vẫn cho phép cross-origin', img.status === 200 && img.headers.get('cross-origin-resource-policy') === 'cross-origin', img.headers.get('cross-origin-resource-policy'));
const good = await api('GET', '/api/categories', { headers: { Origin: 'http://localhost:3000' } });
check('CORS cho phép FE localhost:3000', good.headers.get('access-control-allow-origin') === 'http://localhost:3000');
const evil = await api('GET', '/api/categories', { headers: { Origin: 'http://evil.example' } });
check('CORS không cho origin lạ', !evil.headers.get('access-control-allow-origin'), evil.headers.get('access-control-allow-origin'));
const hugeBody = await api('POST', '/api/auth/login', { json: { email: 'x'.repeat(1_100_000), password: P } });
check('Body JSON > 1MB bị từ chối', hugeBody.status === 413, `status ${hugeBody.status}`);

// 7. rate limit (run last; counts all auth requests from this IP)
let lastStatus = 0;
for (let i = 0; i < 25 && lastStatus !== 429; i++) {
  lastStatus = (await api('POST', '/api/auth/login', { json: { email: 'nobody@t.io', password: 'wrong' } })).status;
}
check('Đăng nhập quá nhiều lần bị 429', lastStatus === 429, `status ${lastStatus}`);
const meStill = await api('GET', '/api/auth/me', { token: J });
check('Các API khác không bị rate limit', meStill.status === 200);

await mongoose.connect(MONGO);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
// Remove only the files this run created
for (const dir of ['cv', 'logos', 'avatars']) {
  for (const f of fs.readdirSync(path.join(BE, 'uploads', dir))) {
    if (!preexisting.has(`${dir}/${f}`)) fs.unlinkSync(path.join(BE, 'uploads', dir, f));
  }
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
