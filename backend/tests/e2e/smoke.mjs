// Smoke test: call every backend endpoint at least once with the right role
// and valid data, check status codes, catch any 500, and check response bodies.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const [BE, BASE, MONGO] = process.argv.slice(2);
const require = createRequire(path.join(BE, 'package.json'));
const mongoose = require('mongoose');

const results = []; // { group, name, ok, info }
const seen500 = [];
let group = '';
const check = (name, ok, info = '') => results.push({ group, name, ok: Boolean(ok), info });

const api = async (method, url, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + url, { method, headers, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data; try { data = JSON.parse(buf.toString()); } catch { data = buf; }
  if (res.status >= 500) seen500.push(`${method} ${url} -> ${res.status} ${JSON.stringify(data?.error ?? '')}`);
  return { status: res.status, data, headers: res.headers };
};
// call + check status in one go
const expect = async (name, method, url, status, opts = {}, extra) => {
  const r = await api(method, url, opts);
  let ok = r.status === status;
  let info = `${r.status}`;
  if (ok && extra) {
    try { const e = extra(r); ok = e === true || (e && e.ok); if (e && e.info) info += ` ${e.info}`; }
    catch (err) { ok = false; info += ` (${err.message})`; }
  } else if (!ok) info += ` ${typeof r.data === 'object' && !Buffer.isBuffer(r.data) ? JSON.stringify(r.data.error ?? '') : ''}`;
  check(`${method} ${url.replace(/[a-f0-9]{24}/g, ':id').replace(/cv-[^/]+|company-[^/]+|user-[^/]+/g, ':file')} → ${status}${name ? ' (' + name + ')' : ''}`, ok, info);
  return r;
};
const fileForm = (field, name, type, bytes) => {
  const f = new FormData();
  f.append(field, new Blob([bytes], { type }), name);
  return f;
};

const preexisting = new Set(
  ['cv', 'logos', 'avatars'].flatMap((d) => fs.readdirSync(path.join(BE, 'uploads', d)).map((f) => `${d}/${f}`))
);
const jpg = fs.readFileSync(path.join(BE, 'src/assets/defaults/default-avatar.jpg'));
const png = fs.readFileSync(path.join(BE, 'src/assets/defaults/default-company-logo.png'));
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
const P = 'Passw0rd!';
const NEWP = 'N3wPassw0rd!';

// ===================== Server & static =====================
group = 'Server';
await expect('', 'GET', '/', 200, {}, (r) => r.data.message?.includes('JobPortal'));
await expect('ảnh mặc định', 'GET', '/uploads/avatars/default-avatar.jpg', 200);
await expect('ảnh mặc định', 'GET', '/uploads/logos/default-company-logo.png', 200);
await expect('route không tồn tại', 'GET', '/api/khong-ton-tai', 404);

// ===================== Auth =====================
group = 'Auth';
const regE = await expect('employer', 'POST', '/api/auth/register', 201, { json: { name: 'Emp', email: 'emp@t.io', password: P, role: 'employer' } }, (r) => Boolean(r.data.token));
const E = regE.data.token;
const J = (await expect('jobseeker', 'POST', '/api/auth/register', 201, { json: { name: 'Seeker', email: 'js@t.io', password: P, role: 'jobseeker' } })).data.token;
const J2 = (await api('POST', '/api/auth/register', { json: { name: 'Seeker2', email: 'js2@t.io', password: P, role: 'jobseeker' } })).data.token;
await expect('email trùng', 'POST', '/api/auth/register', 400, { json: { name: 'X', email: 'emp@t.io', password: P, role: 'employer' } });
await expect('', 'POST', '/api/auth/login', 200, { json: { email: 'emp@t.io', password: P } }, (r) => r.data.user?.role === 'employer');
await expect('sai mật khẩu', 'POST', '/api/auth/login', 401, { json: { email: 'emp@t.io', password: 'Wrong123!' } });
await expect('', 'GET', '/api/auth/me', 200, { token: J }, (r) => r.data.data?.email === 'js@t.io' && !('password' in r.data.data));
await expect('không token', 'GET', '/api/auth/me', 401);
await expect('', 'GET', '/api/auth/logout', 200);
await expect('', 'POST', '/api/auth/forgot-password', 200, { json: { email: 'js2@t.io' } });
await expect('token sai', 'POST', '/api/auth/reset-password', 400, { json: { token: 'x'.repeat(64), password: NEWP } });

// admin via script
const { execFileSync } = await import('child_process');
execFileSync('node', ['scripts/createAdmin.js', 'admin@t.io', P, 'Admin'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO } });
const A = (await api('POST', '/api/auth/login', { json: { email: 'admin@t.io', password: P } })).data.token;
check('npm run create-admin tạo được admin và đăng nhập được', Boolean(A));
// Endpoint admin (chi tiết ở bộ admin.mjs)
await expect('admin xem người dùng', 'GET', '/api/admin/users', 200, { token: A }, (r) => r.data.total >= 4);
await expect('admin xem tin', 'GET', '/api/admin/jobs', 200, { token: A });
await expect('admin xem công ty', 'GET', '/api/admin/companies', 200, { token: A });
await expect('NTD không vào API admin', 'GET', '/api/admin/users', 403, { token: E });
await expect('admin: khoá với id sai trả 400', 'PUT', '/api/admin/users/abc/status', 400, { token: A, json: { isActive: false } });
await expect('admin: xoá tài khoản với id sai trả 400', 'DELETE', '/api/admin/users/abc', 400, { token: A });
await expect('NTD không xoá được tài khoản qua API admin', 'DELETE', '/api/admin/users/000000000000000000000000', 403, { token: E });
await expect('admin: đánh dấu nổi bật tin không tồn tại', 'PUT', `/api/admin/jobs/${'0'.repeat(24)}/featured`, 404, { token: A, json: { featured: true } });
await expect('admin: gói cho công ty không tồn tại', 'PUT', `/api/admin/companies/${'0'.repeat(24)}/subscription`, 404, { token: A, json: { type: 'free' } });

// --- Cài đặt tài khoản (tài khoản riêng, vì đổi mật khẩu làm token cũ hết hiệu lực) ---
const accToken = (await api('POST', '/api/auth/register', { json: { name: 'Acc', email: 'acc@t.io', password: P, role: 'jobseeker' } })).data.token;
await expect('đổi tên và số điện thoại', 'PUT', '/api/auth/me', 200, { token: accToken, json: { name: '  Nguyễn Văn A  ', phone: '0901 234 567' } },
  (r) => (r.data.data?.name === 'Nguyễn Văn A' && r.data.data?.phone === '0901 234 567') || { ok: false, info: JSON.stringify(r.data.data) });
await expect('không đổi được email/vai trò qua PUT /me', 'PUT', '/api/auth/me', 200, { token: accToken, json: { name: 'Acc', email: 'hacker@t.io', role: 'admin' } },
  (r) => (r.data.data?.email === 'acc@t.io' && r.data.data?.role === 'jobseeker') || { ok: false, info: JSON.stringify(r.data.data) });
await expect('tên trống trả 400', 'PUT', '/api/auth/me', 400, { token: accToken, json: { name: '   ' } });
await expect('số điện thoại sai trả 400', 'PUT', '/api/auth/me', 400, { token: accToken, json: { name: 'Acc', phone: 'abc<script>' } });
await expect('chưa đăng nhập không sửa được', 'PUT', '/api/auth/me', 401, { json: { name: 'X' } });
await expect('đổi mật khẩu: sai mật khẩu hiện tại', 'PUT', '/api/auth/password', 400, { token: accToken, json: { currentPassword: 'Wrong123!', newPassword: NEWP } });
await expect('đổi mật khẩu: mật khẩu mới yếu', 'PUT', '/api/auth/password', 400, { token: accToken, json: { currentPassword: P, newPassword: 'weak' } });
await expect('đổi mật khẩu: trùng mật khẩu cũ', 'PUT', '/api/auth/password', 400, { token: accToken, json: { currentPassword: P, newPassword: P } });
const changed = await expect('đổi mật khẩu thành công, trả token mới', 'PUT', '/api/auth/password', 200, { token: accToken, json: { currentPassword: P, newPassword: NEWP } },
  (r) => (Boolean(r.data.token) && r.data.token !== accToken) || { ok: false, info: 'không có token mới' });
await expect('token cũ hết hiệu lực sau khi đổi mật khẩu', 'GET', '/api/auth/me', 401, { token: accToken });
await expect('token mới dùng được', 'GET', '/api/auth/me', 200, { token: changed.data.token }, (r) => r.data.data?.email === 'acc@t.io');
await expect('đăng nhập bằng mật khẩu mới', 'POST', '/api/auth/login', 200, { json: { email: 'acc@t.io', password: NEWP } });
await expect('mật khẩu cũ không đăng nhập được', 'POST', '/api/auth/login', 401, { json: { email: 'acc@t.io', password: P } });

// ===================== Categories =====================
group = 'Categories';
const cat = await expect('admin', 'POST', '/api/categories', 201, { token: A, json: { name: 'Công nghệ thông tin', type: 'industry' } }, (r) => r.data.data?.slug === 'cong-nghe-thong-tin' || { ok: true, info: `slug=${r.data.data?.slug}` });
const catId = cat.data.data?._id;
await api('POST', '/api/categories', { token: A, json: { name: 'React', type: 'skill' } });
await expect('NTD không được tạo', 'POST', '/api/categories', 403, { token: E, json: { name: 'X', type: 'industry' } });
await expect('thiếu type', 'POST', '/api/categories', 400, { token: A, json: { name: 'Y' } });
await expect('', 'GET', '/api/categories', 200, {}, (r) => r.data.count === 2);
await expect('', 'GET', '/api/categories/type/skill', 200, {}, (r) => r.data.count === 1 && r.data.data[0].name === 'React');
await expect('', 'GET', '/api/categories?active=true', 200, {}, (r) => r.data.count === 2);
await expect('', 'GET', `/api/categories/${catId}`, 200, {}, (r) => r.data.data?.name === 'Công nghệ thông tin');
await expect('', 'PUT', `/api/categories/${catId}`, 200, { token: A, json: { description: 'IT', active: false } }, (r) => r.data.data?.active === false);
await expect('id không tồn tại', 'GET', `/api/categories/${new mongoose.Types.ObjectId()}`, 404);

// ===================== Companies =====================
group = 'Companies';
await expect('chưa có công ty', 'GET', '/api/companies', 404, { token: E });
const logoDir = path.join(BE, 'uploads', 'logos');
const logoCountBefore = fs.readdirSync(logoDir).length;
await expect('tải logo khi chưa có công ty', 'PUT', '/api/companies/logo', 404, { token: E, form: fileForm('logo', 'logo.png', 'image/png', png) });
check('PUT /api/companies/logo → chưa có công ty thì không để lại file logo', fs.readdirSync(logoDir).length === logoCountBefore, `trước ${logoCountBefore}, sau ${fs.readdirSync(logoDir).length}`);
// Ngành của công ty/tin phải là danh mục ngành đang hiện. Lúc này "Công nghệ thông tin" đang bị ẩn (dòng trên).
const companyBase = { name: 'ACME', description: 'Công ty phần mềm', location: 'Hà Nội' };
await expect('tạo công ty với ngành không có trong danh mục trả 400', 'POST', '/api/companies', 400, { token: E, json: { ...companyBase, industry: 'Ngành lạ' } },
  (r) => /không có trong danh sách/.test(r.data.error) || { ok: false, info: r.data.error });
await expect('tạo công ty với ngành đã ẩn trả 400', 'POST', '/api/companies', 400, { token: E, json: { ...companyBase, industry: 'Công nghệ thông tin' } });
await expect('tạo công ty với ngành là danh mục kỹ năng trả 400', 'POST', '/api/companies', 400, { token: E, json: { ...companyBase, industry: 'React' } });
await expect('ngành là object trả 400 (không 500)', 'POST', '/api/companies', 400, { token: E, json: { ...companyBase, industry: { $ne: null } } });
const itCat = await expect('admin tạo ngành IT', 'POST', '/api/categories', 201, { token: A, json: { name: 'IT', type: 'industry' } });
const itCatId = itCat.data.data?._id;
await expect('tạo', 'POST', '/api/companies', 201, { token: E, json: { name: 'ACME', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội', website: 'https://acme.vn' } });
await expect('sửa', 'PUT', '/api/companies', 200, { token: E, json: { name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' } }, (r) => r.data.data?.name === 'ACME Corp');
const myCompany = await expect('', 'GET', '/api/companies', 200, { token: E }, (r) => r.data.data?.name === 'ACME Corp');
await expect('website công ty javascript: bị chặn', 'PUT', '/api/companies', 400, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, website: 'javascript:alert(1)//http://a.com' } });
await expect('link Facebook javascript: bị chặn', 'PUT', '/api/companies', 400, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, socialMedia: { facebook: 'javascript:alert(1)' } } });
await expect('sửa công ty xoá trống mô tả trả 400', 'PUT', '/api/companies', 400, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, description: '' } });
await expect('quy mô công ty sai trả 400', 'PUT', '/api/companies', 400, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, companySize: 'abc' } });
await expect('năm thành lập sai trả 400', 'PUT', '/api/companies', 400, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, foundedYear: 3000 } });
await expect('sửa công ty hợp lệ', 'PUT', '/api/companies', 200, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, companySize: '51-200', foundedYear: 2015, website: 'https://acme.vn' } },
  (r) => (r.data.data?.companySize === '51-200' && r.data.data?.foundedYear === 2015) || { ok: false, info: JSON.stringify(r.data.data) });
await expect('NTD không tự đặt featured cho công ty', 'PUT', '/api/companies', 200, { token: E, json: { ...{ name: 'ACME Corp', description: 'Công ty phần mềm', industry: 'IT', location: 'Hà Nội' }, featured: true, subscription: { plan: 'enterprise' } } },
  (r) => (r.data.data?.featured !== true && r.data.data?.subscription?.plan !== 'enterprise') || { ok: false, info: 'featured/subscription bị đổi' });
const companyId = myCompany.data.data?._id;
await expect('ứng viên không được', 'GET', '/api/companies', 403, { token: J });
const logoUp = await expect('', 'PUT', '/api/companies/logo', 200, { token: E, form: fileForm('logo', 'logo.png', 'image/png', png) }, (r) => r.data.data?.logoUrl?.startsWith('/uploads/logos/'));
const logoFile = logoUp.data.data?.logo;
await expect('', 'GET', `/api/companies/logo/${logoFile}`, 200);
await expect('qua static', 'GET', `/uploads/logos/${logoFile}`, 200);
await expect('', 'GET', '/api/companies/all', 200, {}, (r) => r.data.count === 1 && r.data.totalPages === 1);
await expect('', 'GET', '/api/companies/all?search=acme', 200, {}, (r) => r.data.count === 1);
await expect('', 'GET', `/api/companies/${companyId}`, 200, {}, (r) => r.data.data?.logo === logoFile);
await expect('chưa có tin', 'GET', '/api/companies/stats', 200, { token: E }, (r) => r.data.data?.jobStats?.total === 0);

// ===================== Jobs =====================
group = 'Jobs';
const jobBody = { title: 'Lập trình viên React', description: 'Phát triển web', requirements: '2 năm kinh nghiệm', benefits: 'Lương tháng 13', location: 'Hà Nội', jobType: 'full-time', category: 'Công nghệ thông tin', skills: 'React, Node', experienceLevel: 'junior', salaryMin: 15000000, salaryMax: 25000000, applicationDeadline: '2030-01-01' };
await expect('đăng tin với ngành đã ẩn trả 400', 'POST', '/api/jobs', 400, { token: E, json: jobBody });
await expect('đăng tin với ngành không có trong danh mục trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, category: 'Ngành lạ' } });
await api('PUT', `/api/categories/${catId}`, { token: A, json: { active: true } }); // hiện lại để đăng tin
const job1 =await expect('', 'POST', '/api/jobs', 201, { token: E, json: jobBody }, (r) => r.data.data?.skills?.length === 2);
const jobId = job1.data.data?._id;
const job2Id = (await expect('tin thứ 2', 'POST', '/api/jobs', 201, { token: E, json: { ...jobBody, title: 'Backend Node.js', skills: ['Node'] } })).data.data?._id;
// Admin ẩn ngành sau khi đã có tin/công ty dùng: giữ nguyên ngành cũ thì vẫn sửa được thông tin khác
await api('PUT', `/api/categories/${catId}`, { token: A, json: { active: false } });
await api('PUT', `/api/categories/${itCatId}`, { token: A, json: { active: false } });
await expect('sửa tin giữ nguyên ngành đã ẩn vẫn được', 'PUT', `/api/jobs/${jobId}`, 200, { token: E, json: { ...jobBody, title: 'Lập trình viên React' } });
await expect('sửa tin đổi sang ngành đã ẩn khác trả 400', 'PUT', `/api/jobs/${jobId}`, 400, { token: E, json: { category: 'IT' } });
await expect('sửa tin đổi sang ngành không có trả 400', 'PUT', `/api/jobs/${jobId}`, 400, { token: E, json: { category: 'Ngành lạ' } });
await expect('sửa công ty giữ nguyên ngành đã ẩn vẫn được', 'PUT', '/api/companies', 200, { token: E, json: { ...companyBase, name: 'ACME Corp', industry: 'IT', companySize: '51-200', foundedYear: 2015, website: 'https://acme.vn' } });
await expect('sửa công ty đổi sang ngành đã ẩn khác trả 400', 'PUT', '/api/companies', 400, { token: E, json: { ...companyBase, name: 'ACME Corp', industry: 'Công nghệ thông tin' } });
await api('PUT', `/api/categories/${catId}`, { token: A, json: { active: true } });
await api('PUT', `/api/categories/${itCatId}`, { token: A, json: { active: true } });
// --- Trang công ty công khai ---
await expect('danh sách công ty không lộ user/subscription', 'GET', '/api/companies/all', 200, {},
  (r) => (r.data.count >= 1 && !r.data.data.some((c) => 'user' in c || 'subscription' in c)) || { ok: false, info: Object.keys(r.data.data?.[0] ?? {}).join(',') });
await expect('danh sách công ty có số việc đang tuyển', 'GET', '/api/companies/all?search=acme', 200, {},
  (r) => r.data.data?.[0]?.openJobCount === 2 || { ok: false, info: `openJobCount=${r.data.data?.[0]?.openJobCount}` });
await expect('chi tiết công ty không lộ user/subscription', 'GET', `/api/companies/${companyId}`, 200, {},
  (r) => (r.data.data?.name && !('user' in r.data.data) && !('subscription' in r.data.data) && r.data.data.openJobCount === 2) || { ok: false, info: Object.keys(r.data.data ?? {}).join(',') });
await expect('công ty id sai định dạng trả 400', 'GET', '/api/companies/abc', 400);
await expect('lọc tin theo công ty', 'GET', `/api/jobs?company=${companyId}`, 200, {},
  (r) => (r.data.count === 2 && r.data.data.every((j) => j.company?._id === companyId)) || { ok: false, info: `count=${r.data.count}` });
await expect('lọc tin theo công ty với id sai trả 400', 'GET', '/api/jobs?company=abc', 400);
await expect('?category[$ne]=<ngành của 2 tin> không thành toán tử MongoDB (vẫn trả 2 tin)', 'GET', `/api/jobs?category[$ne]=${encodeURIComponent('Công nghệ thông tin')}`, 200, {},
  (r) => r.data.count === 2 || { ok: false, info: `count=${r.data.count}` });
await expect('?skills[]= (mảng) không gây lỗi 500', 'GET', '/api/jobs?skills[]=React&skills[]=Node', 200);
await expect('?keyword[a]= (object) không gây lỗi 500', 'GET', '/api/jobs?keyword[a]=b', 200);
await expect('?industry[$ne]= của công ty không thành toán tử', 'GET', '/api/companies/all?industry[$ne]=xyz', 200);
await expect('lương tối thiểu lớn hơn tối đa trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, salaryMin: 30000000, salaryMax: 20000000 } });
await expect('hạn nộp ở quá khứ trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, applicationDeadline: '2020-01-01' } });
await expect('tiêu đề quá dài trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, title: 'a'.repeat(151) } });
await expect('đơn vị tiền sai trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, salaryCurrency: 'BTC' } });
await expect('sửa lương tối đa thấp hơn tối thiểu cũ trả 400', 'PUT', `/api/jobs/${jobId}`, 400, { token: E, json: { salaryMax: 1000 } });
await expect('sửa tin không gửi status vẫn giữ status', 'PUT', `/api/jobs/${jobId}`, 200, { token: E, json: { title: 'Lập trình viên React', status: 'closed' } },
  (r) => r.data.data?.status === 'active' || { ok: false, info: r.data.data?.status });
await expect('ứng viên không được đăng', 'POST', '/api/jobs', 403, { token: J, json: jobBody });
await expect('thiếu trường', 'POST', '/api/jobs', 400, { token: E, json: { title: 'X' } });
await expect('', 'GET', '/api/jobs', 200, {}, (r) => r.data.count === 2 && r.data.data[0].company?.name === 'ACME Corp');
await expect('lọc', 'GET', '/api/jobs?jobType=full-time&experienceLevel=junior&skills=Node&location=hà nội&salary=20000000', 200, {}, (r) => r.data.count === 2 || { ok: false, info: `count=${r.data.count}` });
await expect('từ khoá', 'GET', '/api/jobs?keyword=React', 200, {}, (r) => r.data.count >= 1 || { ok: false, info: `count=${r.data.count}` });
await expect('phân trang', 'GET', '/api/jobs?limit=1&page=2', 200, {}, (r) => r.data.count === 1 && r.data.pagination?.prev?.page === 1);
const viewed = await expect('', 'GET', `/api/jobs/${jobId}`, 200, {}, (r) => r.data.data?.company?.name === 'ACME Corp');
await expect('lượt xem tăng', 'GET', `/api/jobs/${jobId}`, 200, {}, (r) => r.data.data?.views === viewed.data.data?.views + 1);
await expect('', 'GET', `/api/jobs/${jobId}/similar`, 200, {}, (r) => r.data.count === 1 && r.data.data[0]._id === job2Id);
await expect('', 'GET', '/api/jobs/employer/myjobs', 200, { token: E }, (r) => r.data.count === 2);
await expect('', 'PUT', `/api/jobs/${job2Id}`, 200, { token: E, json: { title: 'Backend Node.js (Senior)', skills: 'Node, Mongo' } }, (r) => r.data.data?.skills?.length === 2);
await expect('', 'PUT', `/api/jobs/${job2Id}/status`, 200, { token: E, json: { status: 'closed' } }, (r) => r.data.data?.status === 'closed');
await expect('status sai', 'PUT', `/api/jobs/${job2Id}/status`, 400, { token: E, json: { status: 'abc' } });
const closedView = await expect('tin đã đóng vẫn xem được', 'GET', `/api/jobs/${job2Id}`, 200, {}, (r) => r.data.data?.status === 'closed');
await expect('tin đã đóng không tăng lượt xem', 'GET', `/api/jobs/${job2Id}`, 200, {},
  (r) => r.data.data?.views === closedView.data.data?.views || { ok: false, info: `${closedView.data.data?.views} → ${r.data.data?.views}` });

// ===================== Profiles / CV =====================
group = 'Profiles & CV';
await expect('chưa có hồ sơ', 'GET', '/api/profiles', 404, { token: J });
await expect('tạo', 'POST', '/api/profiles', 201, { token: J, json: { title: 'Frontend Dev', bio: 'Xin chào', skills: 'React, TS', location: 'Hà Nội' } }, (r) => r.data.data?.skills?.length === 2);
await expect('sửa', 'PUT', '/api/profiles', 200, { token: J, json: { title: 'Senior Frontend', skills: ['React'] } }, (r) => r.data.data?.title === 'Senior Frontend');
await expect('NTD không được tạo', 'POST', '/api/profiles', 403, { token: E, json: { title: 'x' } });
const edu = await expect('', 'PUT', '/api/profiles/education', 200, { token: J, json: { school: 'ĐH Bách Khoa', degree: 'Kỹ sư', fieldOfStudy: 'CNTT', from: '2018-09-01', to: '2022-06-01' } }, (r) => r.data.data?.education?.length === 1);
const eduId = edu.data.data?.education?.[0]?._id;
await expect('thiếu trường', 'PUT', '/api/profiles/education', 400, { token: J, json: { school: 'X' } });
await expect('thiếu ngày kết thúc khi không phải đang học', 'PUT', '/api/profiles/education', 400, { token: J, json: { school: 'X', degree: 'Y', fieldOfStudy: 'Z', from: '2018-09-01' } });
await expect('ngày kết thúc trước ngày bắt đầu', 'PUT', '/api/profiles/education', 400, { token: J, json: { school: 'X', degree: 'Y', fieldOfStudy: 'Z', from: '2020-01-01', to: '2019-01-01' } });
await expect('ngày sai định dạng trả 400', 'PUT', '/api/profiles/education', 400, { token: J, json: { school: 'X', degree: 'Y', fieldOfStudy: 'Z', from: 'abc', current: true } });
await expect('sửa học vấn', 'PUT', `/api/profiles/education/${eduId}`, 200, { token: J, json: { school: 'ĐH Bách Khoa HN', degree: 'Kỹ sư', fieldOfStudy: 'CNTT', from: '2018-09-01', current: true, to: '2022-06-01' } },
  (r) => (r.data.data?.education?.[0]?.school === 'ĐH Bách Khoa HN' && r.data.data.education[0].current === true && !r.data.data.education[0].to) || { ok: false, info: JSON.stringify(r.data.data?.education?.[0]) });
await expect('sửa học vấn không tồn tại', 'PUT', `/api/profiles/education/${'0'.repeat(24)}`, 404, { token: J, json: { school: 'X', degree: 'Y', fieldOfStudy: 'Z', from: '2018-09-01', current: true } });
await expect('', 'DELETE', `/api/profiles/education/${eduId}`, 200, { token: J }, (r) => r.data.data?.education?.length === 0);
const exp = await expect('', 'PUT', '/api/profiles/experience', 200, { token: J, json: { company: 'FPT', position: 'Dev', from: '2020-01-01', to: '2021-12-01' } }, (r) => r.data.data?.experience?.length === 1);
const expId = exp.data.data?.experience?.[0]?._id;
await expect('kinh nghiệm đang làm xếp lên đầu', 'PUT', '/api/profiles/experience', 200, { token: J, json: { company: 'VNG', position: 'Senior Dev', from: '2022-01-01', current: true } },
  (r) => (r.data.data?.experience?.length === 2 && r.data.data.experience[0].company === 'VNG') || { ok: false, info: r.data.data?.experience?.map((e) => e.company).join(',') });
const exp2Id = (await api('GET', '/api/profiles', { token: J })).data.data?.experience?.[0]?._id;
await expect('sửa kinh nghiệm', 'PUT', `/api/profiles/experience/${expId}`, 200, { token: J, json: { company: 'FPT Software', position: 'Dev', from: '2020-01-01', to: '2021-12-01' } },
  (r) => r.data.data?.experience?.some((e) => e.company === 'FPT Software'));
await expect('', 'DELETE', `/api/profiles/experience/${expId}`, 200, { token: J }, (r) => r.data.data?.experience?.length === 1);
await expect('', 'DELETE', `/api/profiles/experience/${exp2Id}`, 200, { token: J }, (r) => r.data.data?.experience?.length === 0);
await expect('link javascript: bị chặn', 'PUT', '/api/profiles', 400, { token: J, json: { title: 'Senior Frontend', website: 'javascript:alert(1)' } });
await expect('link LinkedIn javascript: bị chặn', 'PUT', '/api/profiles', 400, { token: J, json: { title: 'Senior Frontend', socialMedia: { linkedin: 'javascript:alert(1)' } } });
await expect('workType sai trả 400', 'PUT', '/api/profiles', 400, { token: J, json: { title: 'Senior Frontend', workType: 'abc' } });
await expect('lương âm trả 400', 'PUT', '/api/profiles', 400, { token: J, json: { title: 'Senior Frontend', desiredSalary: -1 } });
await expect('xoá hết kỹ năng bằng mảng rỗng', 'PUT', '/api/profiles', 200, { token: J, json: { title: 'Senior Frontend', skills: [] } }, (r) => r.data.data?.skills?.length === 0);
await expect('kỹ năng trùng bị gộp', 'PUT', '/api/profiles', 200, { token: J, json: { title: 'Senior Frontend', skills: ['React', 'react', ' Node '], website: 'https://me.dev' } },
  (r) => (r.data.data?.skills?.join(',') === 'React,Node' && r.data.data?.website === 'https://me.dev') || { ok: false, info: r.data.data?.skills?.join(',') });
const av = await expect('', 'PUT', '/api/profiles/avatar', 200, { token: J, form: fileForm('avatar', 'a.jpg', 'image/jpeg', jpg) }, (r) => r.data.data?.avatarUrl?.startsWith('/uploads/avatars/'));
const avFile = av.data.data?.avatar;
await expect('', 'GET', `/api/profiles/avatar/${avFile}`, 200);
await expect('qua static', 'GET', `/uploads/avatars/${avFile}`, 200);
await expect('', 'DELETE', '/api/profiles/avatar', 200, { token: J });
await expect('file avatar đã bị xoá', 'GET', `/uploads/avatars/${avFile}`, 404);
await expect('', 'GET', '/api/profiles', 200, { token: J }, (r) => r.data.data?.user?.email === 'js@t.io');
const meJ = (await api('GET', '/api/auth/me', { token: J })).data.data;
await expect('chưa đăng nhập', 'GET', '/api/profiles/all', 401);
await expect('ứng viên không được', 'GET', '/api/profiles/all', 403, { token: J });
await expect('NTD', 'GET', '/api/profiles/all', 200, { token: E }, (r) => r.data.count === 1);
await expect('chưa đăng nhập', 'GET', `/api/profiles/user/${meJ.id}`, 401);
await expect('NTD xem', 'GET', `/api/profiles/user/${meJ.id}`, 200, { token: E }, (r) => r.data.data?.title === 'Senior Frontend' && !('cvFile' in r.data.data));
await expect('chủ hồ sơ xem', 'GET', `/api/profiles/user/${meJ.id}`, 200, { token: J });
await expect('ứng viên khác xem', 'GET', `/api/profiles/user/${meJ.id}`, 403, { token: J2 });
const cv = await expect('', 'PUT', '/api/cv/upload', 200, { token: J, form: fileForm('cv', 'CV.pdf', 'application/pdf', pdf) }, (r) => r.data.data?.filePath?.startsWith('/api/cv/'));
const cvFile = cv.data.data?.fileName;
await expect('', 'GET', `/api/cv/${cvFile}`, 200, { token: J });
// J2 profile + CV for later
await api('POST', '/api/profiles', { token: J2, json: { title: 'Tester' } });
await api('PUT', '/api/cv/upload', { token: J2, form: fileForm('cv', 'cv.pdf', 'application/pdf', pdf) });
const cv2Tmp = (await api('PUT', '/api/cv/upload', { token: J2, form: fileForm('cv', 'cv2.pdf', 'application/pdf', pdf) })).data.data?.fileName;
await expect('', 'DELETE', '/api/cv', 200, { token: J2 });
await expect('không còn CV', 'DELETE', '/api/cv', 400, { token: J2 });
await expect('file CV đã xoá', 'GET', `/api/cv/${cv2Tmp}`, 404, { token: A });
await api('PUT', '/api/cv/upload', { token: J2, form: fileForm('cv', 'cv3.pdf', 'application/pdf', pdf) });

// ===================== Saved jobs =====================
group = 'Saved jobs';
await expect('', 'POST', `/api/saved-jobs/${jobId}`, 201, { token: J });
await expect('lưu trùng', 'POST', `/api/saved-jobs/${jobId}`, 400, { token: J });
await expect('', 'GET', '/api/saved-jobs', 200, { token: J }, (r) => r.data.count === 1 && r.data.data[0].job?.title === 'Lập trình viên React' && r.data.data[0].job?.company?.name === 'ACME Corp');
await expect('', 'DELETE', `/api/saved-jobs/${jobId}`, 200, { token: J });
await expect('chưa lưu', 'DELETE', `/api/saved-jobs/${jobId}`, 404, { token: J });
await expect('NTD không được', 'GET', '/api/saved-jobs', 403, { token: E });
await api('POST', `/api/saved-jobs/${jobId}`, { token: J });
// job2Id đang 'closed': tin đã đóng vẫn lưu được
await expect('lưu tin đã đóng', 'POST', `/api/saved-jobs/${job2Id}`, 201, { token: J });
await expect('', 'GET', '/api/saved-jobs/ids', 200, { token: J }, (r) => r.data.data?.length === 2 && r.data.data.includes(jobId) && r.data.data.includes(job2Id));
await expect('NTD không được', 'GET', '/api/saved-jobs/ids', 403, { token: E });
await expect('phân trang', 'GET', '/api/saved-jobs?limit=1&page=2', 200, { token: J },
  (r) => r.data.total === 2 && r.data.totalPages === 2 && r.data.count === 1 && r.data.data[0].job?._id === jobId && 'salaryMin' in r.data.data[0].job && Array.isArray(r.data.data[0].job.skills));
await expect('page/limit sai không 500', 'GET', '/api/saved-jobs?limit=-5&page=abc', 200, { token: J }, (r) => r.data.total === 2);
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'draft' } });
await expect('tin chuyển về nháp bị ẩn khỏi danh sách', 'GET', '/api/saved-jobs', 200, { token: J },
  (r) => r.data.total === 1 && r.data.data.every((s) => s.job?._id !== job2Id));
await api('DELETE', `/api/saved-jobs/${job2Id}`, { token: J });
await expect('không lưu được tin nháp', 'POST', `/api/saved-jobs/${job2Id}`, 404, { token: J });
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'closed' } });
await expect('', 'POST', `/api/saved-jobs/${job2Id}`, 201, { token: J });
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'draft' } });
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'closed' } });
await expect('tin mở lại từ nháp thì hiện lại', 'GET', '/api/saved-jobs', 200, { token: J }, (r) => r.data.total === 2);
await api('DELETE', `/api/saved-jobs/${job2Id}`, { token: J });

// ===================== Applications =====================
group = 'Applications';
const app1 = await expect('', 'POST', '/api/applications/apply', 201, { token: J, json: { jobId, coverLetter: 'Em xin ứng tuyển' } });
const appId = app1.data.data?._id;
const custom = fileForm('cv', 'rieng.pdf', 'application/pdf', pdf);
custom.append('jobId', jobId);
const app2 = await expect('kèm CV riêng', 'POST', '/api/applications/apply', 201, { token: J2, form: custom }, (r) => r.data.data?.attachedCV?.startsWith('cv-'));
const app2Id = app2.data.data?._id;
await expect('tin đã đóng', 'POST', '/api/applications/apply', 400, { token: J, json: { jobId: job2Id } });
await expect('', 'GET', `/api/applications/job/${jobId}`, 200, { token: E }, (r) => r.data.count === 2);
await expect('', 'GET', '/api/applications/user/myapplications', 200, { token: J }, (r) => r.data.count === 1 && r.data.data[0].job?.company?.name === 'ACME Corp');
await expect('ứng viên xem', 'GET', `/api/applications/${appId}`, 200, { token: J });
await expect('ứng viên xem chi tiết đơn có thông tin tin tuyển dụng', 'GET', `/api/applications/${appId}`, 200, { token: J },
  (r) => Boolean(r.data.data?.job?.location && r.data.data?.job?.status && r.data.data?.job?.company?.logo) || { ok: false, info: JSON.stringify(r.data.data?.job) });
await expect('ứng viên khác xem đơn trả 403', 'GET', `/api/applications/${appId}`, 403, { token: J2 });
await expect('ứng viên khác tải CV đơn trả 403', 'GET', `/api/applications/${appId}/cv`, 403, { token: J2 });
await expect('NTD xem → viewed', 'GET', `/api/applications/${appId}`, 200, { token: E }, (r) => r.data.data?.status === 'viewed');
await expect('', 'PUT', `/api/applications/${appId}/status`, 200, { token: E, json: { status: 'interview', feedback: 'Hồ sơ tốt' } });
await expect('', 'PUT', `/api/applications/${appId}/schedule-interview`, 200, { token: E, json: { date: '2030-01-10T09:00:00Z', location: 'Văn phòng HN', type: 'in-person', notes: 'Mang CV' } }, (r) => r.data.data?.interviews?.length === 1);
await expect('', 'PUT', `/api/applications/${appId}/notes`, 200, { token: E, json: { content: 'Ứng viên tiềm năng' } }, (r) => r.data.data?.notes?.length === 1);
// --- Khu NTD: kiểm tra quyền và dữ liệu đầu vào ---
const E2 = (await api('POST', '/api/auth/register', { json: { name: 'Emp2', email: 'emp2@t.io', password: P, role: 'employer' } })).data.token;
await expect('NTD khác xem đơn theo tin trả 403', 'GET', `/api/applications/job/${jobId}`, 403, { token: E2 });
await expect('NTD khác đổi trạng thái đơn trả 403', 'PUT', `/api/applications/${appId}/status`, 403, { token: E2, json: { status: 'rejected' } });
await expect('NTD khác hẹn phỏng vấn trả 403', 'PUT', `/api/applications/${appId}/schedule-interview`, 403, { token: E2, json: { date: '2030-02-01T09:00:00Z', location: 'HN', type: 'video' } });
await expect('NTD khác ghi chú trả 403', 'PUT', `/api/applications/${appId}/notes`, 403, { token: E2, json: { content: 'x' } });
await expect('NTD khác đổi trạng thái tin trả 403', 'PUT', `/api/jobs/${jobId}/status`, 403, { token: E2, json: { status: 'closed' } });
await expect('hẹn phỏng vấn ngày quá khứ trả 400', 'PUT', `/api/applications/${appId}/schedule-interview`, 400, { token: E, json: { date: '2020-01-01T09:00:00Z', location: 'HN', type: 'video' } });
await expect('hẹn phỏng vấn ngày sai định dạng trả 400', 'PUT', `/api/applications/${appId}/schedule-interview`, 400, { token: E, json: { date: 'abc', location: 'HN', type: 'video' } });
await expect('hẹn phỏng vấn hình thức sai trả 400', 'PUT', `/api/applications/${appId}/schedule-interview`, 400, { token: E, json: { date: '2030-02-01T09:00:00Z', location: 'HN', type: 'zoom' } });
await expect('ghi chú quá dài trả 400', 'PUT', `/api/applications/${appId}/notes`, 400, { token: E, json: { content: 'a'.repeat(1001) } });
await expect('phản hồi quá dài trả 400', 'PUT', `/api/applications/${appId}/status`, 400, { token: E, json: { status: 'interview', feedback: 'a'.repeat(1001) } });
await expect('tin của NTD có số đơn', 'GET', '/api/jobs/employer/myjobs', 200, { token: E },
  (r) => { const j = r.data.data?.find((x) => x._id === jobId); return (j?.applicationCount >= 1 && typeof j?.pendingCount === 'number') || { ok: false, info: JSON.stringify({ a: j?.applicationCount, p: j?.pendingCount }) }; });
// --- Phân trang các danh sách (lúc này: E có 2 tin; tin jobId có đơn của J (interview) và J2 (pending)) ---
await expect('tin của NTD: phân trang, pendingTotal tính mọi tin', 'GET', '/api/jobs/employer/myjobs?limit=1&page=2', 200, { token: E },
  (r) => (r.data.total === 2 && r.data.totalPages === 2 && r.data.count === 1 && r.data.pendingTotal === 1) || { ok: false, info: JSON.stringify({ t: r.data.total, tp: r.data.totalPages, c: r.data.count, p: r.data.pendingTotal }) });
await expect('tin của NTD: limit/page sai không 500', 'GET', '/api/jobs/employer/myjobs?limit=abc&page=-1', 200, { token: E }, (r) => r.data.count === 2);
await expect('một tin của NTD kèm số đơn', 'GET', `/api/jobs/employer/myjobs/${jobId}`, 200, { token: E },
  (r) => (r.data.data?._id === jobId && r.data.data.applicationCount === 2 && r.data.data.pendingCount === 1) || { ok: false, info: JSON.stringify({ a: r.data.data?.applicationCount, p: r.data.data?.pendingCount }) });
await expect('một tin của NTD không tăng lượt xem', 'GET', `/api/jobs/employer/myjobs/${jobId}`, 200, { token: E },
  (r) => r.data.data?.views === viewed.data.data?.views + 1 || { ok: false, info: `views ${r.data.data?.views}` });
await expect('NTD khác lấy tin không phải của mình trả 404', 'GET', `/api/jobs/employer/myjobs/${jobId}`, 404, { token: E2 });
await expect('ứng viên không gọi được myjobs/:id', 'GET', `/api/jobs/employer/myjobs/${jobId}`, 403, { token: J });
await expect('myjobs/:id sai định dạng trả 400', 'GET', '/api/jobs/employer/myjobs/abc', 400, { token: E });
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'draft' } });
await expect('tin nháp vẫn lấy được qua myjobs/:id', 'GET', `/api/jobs/employer/myjobs/${job2Id}`, 200, { token: E }, (r) => r.data.data?.status === 'draft');
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'closed' } });
await expect('đơn theo tin: lọc trạng thái, counts tính mọi đơn', 'GET', `/api/applications/job/${jobId}?status=interview`, 200, { token: E },
  (r) => (r.data.total === 1 && r.data.data[0]?._id === appId && r.data.counts?.all === 2 && r.data.counts.interview === 1 && r.data.counts.pending === 1 && r.data.counts.withdrawn === 0) || { ok: false, info: JSON.stringify({ t: r.data.total, counts: r.data.counts }) });
await expect('đơn theo tin: phân trang', 'GET', `/api/applications/job/${jobId}?limit=1&page=2`, 200, { token: E },
  (r) => (r.data.count === 1 && r.data.total === 2 && r.data.totalPages === 2) || { ok: false, info: JSON.stringify({ c: r.data.count, t: r.data.total }) });
await expect('đơn theo tin: trạng thái sai trả 400', 'GET', `/api/applications/job/${jobId}?status=xyz`, 400, { token: E });
await expect('đơn theo tin: status là object trả 400', 'GET', `/api/applications/job/${jobId}?status[$ne]=x`, 400, { token: E });
await expect('đơn của tôi lọc theo tin', 'GET', `/api/applications/user/myapplications?job=${jobId}`, 200, { token: J },
  (r) => (r.data.total === 1 && r.data.data[0]?._id === appId) || { ok: false, info: `total ${r.data.total}` });
await expect('đơn của tôi: tin chưa nộp thì rỗng', 'GET', `/api/applications/user/myapplications?job=${job2Id}`, 200, { token: J }, (r) => r.data.total === 0 && r.data.totalPages === 0);
await expect('đơn của tôi: ?job sai định dạng trả 400', 'GET', '/api/applications/user/myapplications?job=abc', 400, { token: J });
await expect('đơn của tôi: ?job là object trả 400', 'GET', '/api/applications/user/myapplications?job[$ne]=x', 400, { token: J });
const intvNoti = (await api('GET', '/api/notifications', { token: J })).data.data?.find((n) => n.type === 'interview_invitation');
check('Thông báo mời phỏng vấn ghi giờ Việt Nam (09:00Z → 16:00)', Boolean(intvNoti?.message?.includes('16:00 10/01/2030')), intvNoti?.message);

await expect('ứng viên không thấy ghi chú nội bộ (danh sách)', 'GET', '/api/applications/user/myapplications', 200, { token: J },
  (r) => (!JSON.stringify(r.data).includes('Ứng viên tiềm năng') && r.data.data[0]?.interviews?.length === 1 && r.data.data[0]?.employerFeedback === 'Hồ sơ tốt') || { ok: false, info: JSON.stringify(r.data.data?.[0]?.notes) });
await expect('ứng viên không thấy ghi chú nội bộ (chi tiết)', 'GET', `/api/applications/${appId}`, 200, { token: J },
  (r) => (!JSON.stringify(r.data).includes('Ứng viên tiềm năng') && r.data.data?.interviews?.length === 1) || { ok: false, info: 'lộ notes' });
await expect('NTD vẫn thấy ghi chú', 'GET', `/api/applications/${appId}`, 200, { token: E }, (r) => r.data.data?.notes?.length === 1);
await expect('NTD tải CV đơn', 'GET', `/api/applications/${appId}/cv`, 200, { token: E });
await expect('CV riêng của đơn', 'GET', `/api/applications/${app2Id}/cv`, 200, { token: E });
await expect('', 'PUT', `/api/applications/${app2Id}/cancel`, 200, { token: J2 }, (r) => r.data.data?.status === 'withdrawn');
await expect('', 'GET', '/api/companies/stats', 200, { token: E }, (r) => {
  const s = r.data.data;
  return (s.jobStats.total === 2 && s.jobStats.active === 1 && s.applicationStats.total === 2 && s.applicationStats.interview === 1 && s.applicationStats.withdrawn === 1) || { ok: false, info: JSON.stringify(s) };
});

// ===================== Notifications =====================
group = 'Notifications';
const notiJ = await expect('', 'GET', '/api/notifications', 200, { token: J }, (r) => (r.data.count >= 3 && r.data.unreadCount >= 3) || { ok: false, info: `count=${r.data.count} unread=${r.data.unreadCount}` });
const notiId = notiJ.data.data?.[0]?._id;
await expect('', 'PUT', `/api/notifications/${notiId}/read`, 200, { token: J }, (r) => r.data.data?.read === true);
await expect('của người khác', 'PUT', `/api/notifications/${notiId}/read`, 403, { token: E });
await expect('', 'PUT', '/api/notifications/read-all', 200, { token: J });
await expect('hết chưa đọc', 'GET', '/api/notifications', 200, { token: J }, (r) => r.data.unreadCount === 0);
await expect('thông báo: limit bị giới hạn 50', 'GET', '/api/notifications?limit=100000', 200, { token: J },
  (r) => (r.data.count <= 50 && typeof r.data.totalPages === 'number' && typeof r.data.total === 'number') || { ok: false, info: `count=${r.data.count}` });
await expect('thông báo: page âm không lỗi 500', 'GET', '/api/notifications?page=-5&limit=-1', 200, { token: J });
await expect('xoá của người khác', 'DELETE', `/api/notifications/${notiId}`, 403, { token: E });
await expect('', 'DELETE', `/api/notifications/${notiId}`, 200, { token: J });
await expect('NTD có thông báo đơn mới', 'GET', '/api/notifications', 200, { token: E }, (r) => JSON.stringify(r.data).includes('new_application'));

// ===================== Messages =====================
group = 'Messages';
const meE = (await api('GET', '/api/auth/me', { token: E })).data.data;
await expect('', 'POST', '/api/messages', 201, { token: E, json: { receiverId: meJ.id, content: 'Chào bạn, mời phỏng vấn' } });
await expect('', 'POST', '/api/messages', 201, { token: J, json: { receiverId: meE.id, content: 'Dạ em cảm ơn' } });
await api('POST', '/api/messages', { token: E, json: { receiverId: meJ.id, content: 'Hẹn 9h nhé' } });
await expect('thiếu nội dung', 'POST', '/api/messages', 400, { token: E, json: { receiverId: meJ.id } });
await expect('', 'GET', `/api/messages/conversation/${meE.id}`, 200, { token: J }, (r) => r.data.count === 3 && r.data.data[0].content.startsWith('Chào'));
await expect('', 'GET', '/api/messages/conversations', 200, { token: J }, (r) => r.data.count === 1 && r.data.data[0].unreadCount === 2 && r.data.data[0].lastMessage?.content === 'Hẹn 9h nhé');
await expect('', 'PUT', `/api/messages/read/${meE.id}`, 200, { token: J }, (r) => r.data.count === 2);
await expect('đã đọc hết', 'GET', '/api/messages/conversations', 200, { token: J }, (r) => r.data.data[0].unreadCount === 0);

// ===================== Dashboard =====================
group = 'Dashboard';
await expect('admin', 'GET', '/api/dashboard', 200, { token: A }, (r) => JSON.stringify(r.data).includes('"withdrawn":1'));
await expect('', 'GET', '/api/dashboard/admin', 200, { token: A }, (r) => JSON.stringify(r.data).includes('"withdrawn":1'));
await expect('', 'GET', '/api/dashboard/employer', 200, { token: E }, (r) => {
  const d = r.data.data;
  // Nhãn tháng dạng "2026-11" (giờ VN); top tin không tính đơn đã rút
  return d.applications.withdrawn === 1 && d.charts.labels.length === 6 && d.charts.labels.every((k) => /^\d{4}-\d{2}$/.test(k))
    && d.charts.datasets.newJobs.length === 6 && Array.isArray(d.topJobs) && typeof d.jobs.open === 'number';
});
await expect('', 'GET', '/api/dashboard/jobseeker', 200, { token: J }, (r) => JSON.stringify(r.data).includes('"interview":1'));
await expect('NTD xem admin', 'GET', '/api/dashboard/admin', 403, { token: E });

// ===================== Cleanup endpoints =====================
group = 'Xoá dữ liệu';
await expect('xoá ngành đang có tin dùng bị chặn', 'DELETE', `/api/categories/${catId}`, 400, { token: A }, (r) => /đang được dùng/.test(r.data.error) || { ok: false, info: r.data.error });
const unusedCat = (await api('POST', '/api/categories', { token: A, json: { name: 'Ngành tạm', type: 'industry' } })).data.data?._id;
await expect('xoá ngành không ai dùng', 'DELETE', `/api/categories/${unusedCat}`, 200, { token: A });
await expect('NTD xoá tin', 'DELETE', `/api/jobs/${job2Id}`, 200, { token: E });
// Tự xoá tài khoản: DELETE /api/auth/me, bắt nhập mật khẩu. API cũ DELETE /api/profiles đã bỏ.
await expect('API xoá tài khoản cũ đã bỏ', 'DELETE', '/api/profiles', 404, { token: J2 });
await expect('xoá tài khoản thiếu mật khẩu trả 400', 'DELETE', '/api/auth/me', 400, { token: J2 });
await expect('xoá tài khoản mật khẩu là object trả 400', 'DELETE', '/api/auth/me', 400, { token: J2, json: { password: { $ne: null } } });
await expect('xoá tài khoản sai mật khẩu trả 400', 'DELETE', '/api/auth/me', 400, { token: J2, json: { password: 'Wrong123!' } },
  (r) => r.data.error === 'Mật khẩu không đúng' || { ok: false, info: r.data.error });
await expect('sai mật khẩu thì tài khoản còn nguyên', 'GET', '/api/auth/me', 200, { token: J2 });
await expect('admin không tự xoá được', 'DELETE', '/api/auth/me', 403, { token: A, json: { password: P } });
await expect('chưa đăng nhập không xoá được', 'DELETE', '/api/auth/me', 401, { json: { password: P } });
await expect('xoá tài khoản ứng viên', 'DELETE', '/api/auth/me', 200, { token: J2, json: { password: P } });
await expect('token cũ hết hiệu lực', 'GET', '/api/auth/me', 401, { token: J2 });
await expect('tài khoản đã xoá không đăng nhập được', 'POST', '/api/auth/login', 401, { json: { email: 'js2@t.io', password: P } });

// ===================== Probes for suspected issues =====================
group = 'Nghi vấn (kỳ vọng hành vi đúng)';
await expect('NTD không tự đặt featured/views qua sửa tin', 'PUT', `/api/jobs/${jobId}`, 200, { token: E, json: { featured: true, views: 99999 } },
  (r) => (r.data.data?.featured !== true && r.data.data?.views !== 99999) || { ok: false, info: `featured=${r.data.data?.featured} views=${r.data.data?.views}` });
await expect('Sửa tin với dữ liệu sai enum trả 400', 'PUT', `/api/jobs/${jobId}`, 400, { token: E, json: { jobType: 'abc' } });
await expect('Tạo danh mục tên có ký tự regex', 'POST', '/api/categories', 201, { token: A, json: { name: 'C++ (Lập trình)', type: 'skill' } });
await expect('Tạo danh mục trùng tên khác loại trả 400', 'POST', '/api/categories', 400, { token: A, json: { name: 'React', type: 'industry' } });
await expect('Tìm danh mục với ký tự regex', 'GET', '/api/categories?search=' + encodeURIComponent('('), 200);
await expect('Tìm công ty với ký tự regex', 'GET', '/api/companies/all?search=' + encodeURIComponent('('), 200);
await expect('Lọc công ty theo location có ký tự regex', 'GET', '/api/companies/all?location=' + encodeURIComponent('[+'), 200);
await expect('Đổi tên danh mục trùng tên khác trả 400', 'PUT', `/api/categories/${(await api('GET', '/api/categories/type/skill')).data.data.find((c) => c.name === 'React')._id}`, 400, { token: A, json: { name: 'c++ (lập trình)' } });
await expect('Tạo tin với enum sai trả 400', 'POST', '/api/jobs', 400, { token: E, json: { ...jobBody, jobType: 'abc' } });
await expect('Sửa tin vẫn đổi được field hợp lệ', 'PUT', `/api/jobs/${jobId}`, 200, { token: E, json: { title: 'React Dev (đã sửa)', user: meJ.id, status: 'draft' } },
  (r) => (r.data.data?.title === 'React Dev (đã sửa)' && r.data.data?.status === 'active' && r.data.data?.user !== meJ.id) || { ok: false, info: JSON.stringify({ t: r.data.data?.title, s: r.data.data?.status }) });
await expect('Hội thoại của NTD không bị trùng', 'GET', '/api/messages/conversations', 200, { token: E }, (r) => r.data.count === 1 || { ok: false, info: `count=${r.data.count}` });
await expect('Danh sách hồ sơ không lộ cvFile', 'GET', '/api/profiles/all', 200, { token: E },
  (r) => !JSON.stringify(r.data).includes('cvFile') || { ok: false, info: 'có trường cvFile' });
await expect('Tin quá hạn không hiện trong danh sách', 'GET', '/api/jobs', 200, {}, async () => true);

// expired-deadline probe (needs direct DB write)
await mongoose.connect(MONGO);
await mongoose.connection.db.collection('jobs').updateOne({ _id: new mongoose.Types.ObjectId(jobId) }, { $set: { applicationDeadline: new Date('2020-01-01') } });
const afterExpire = await api('GET', '/api/jobs');
results.pop();
check('GET /api/jobs → tin đã quá hạn nộp không còn trong danh sách', !JSON.stringify(afterExpire.data).includes(jobId), `count=${afterExpire.data.count}`);
const reopen = await api('PUT', `/api/jobs/${jobId}/status`, { token: E, json: { status: 'active' } });
check('PUT /api/jobs/:id/status → mở lại tin đã quá hạn trả 400', reopen.status === 400, `${reopen.status} ${reopen.data.error ?? ''}`);
const expiredJob = (await api('GET', '/api/jobs/employer/myjobs', { token: E })).data.data?.find((j) => j._id === jobId);
const keepOldDeadline = await api('PUT', `/api/jobs/${jobId}`, { token: E, json: { title: 'Sửa chính tả', applicationDeadline: expiredJob?.applicationDeadline } });
check('PUT /api/jobs/:id → tin đã quá hạn vẫn sửa được nếu giữ nguyên hạn nộp', keepOldDeadline.status === 200, `${keepOldDeadline.status} ${keepOldDeadline.data.error ?? ''}`);
const newPastDeadline = await api('PUT', `/api/jobs/${jobId}`, { token: E, json: { applicationDeadline: '2021-06-01' } });
check('PUT /api/jobs/:id → đổi sang hạn nộp khác ở quá khứ trả 400', newPastDeadline.status === 400, `${newPastDeadline.status}`);
const empAvatar = await api('PUT', '/api/profiles/avatar', { token: E, form: fileForm('avatar', 'a.jpg', 'image/jpeg', jpg) });
const empMe = (await api('GET', '/api/auth/me', { token: E })).data.data;
check('PUT /api/profiles/avatar → NTD đổi được avatar', empAvatar.status === 200 && empMe.avatar === empAvatar.data.data?.avatar, `${empAvatar.status}`);
const empReset = await api('DELETE', '/api/profiles/avatar', { token: E });
check('DELETE /api/profiles/avatar → NTD khôi phục avatar mặc định', empReset.status === 200, `${empReset.status}`);
// job2 was deleted above, so create a fresh active job in the same category
const job3Id = (await api('POST', '/api/jobs', { token: E, json: jobBody })).data.data?._id;
const simAfter = await api('GET', `/api/jobs/${job3Id}/similar`);
check('Việc tương tự không gồm tin quá hạn', simAfter.status === 200 && !JSON.stringify(simAfter.data).includes(jobId), `${simAfter.status} count=${simAfter.data.count}`);

// ===================== Report =====================
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
for (const dir of ['cv', 'logos', 'avatars']) {
  for (const f of fs.readdirSync(path.join(BE, 'uploads', dir))) {
    if (!preexisting.has(`${dir}/${f}`)) fs.unlinkSync(path.join(BE, 'uploads', dir, f));
  }
}

const groups = [...new Set(results.map((r) => r.group))];
console.log('\n=== Tổng hợp theo nhóm ===');
for (const g of groups) {
  const rs = results.filter((r) => r.group === g);
  console.log(`${g.padEnd(36)} ${rs.filter((r) => r.ok).length}/${rs.length}`);
}
console.log('\n=== Chi tiết các mục FAIL ===');
for (const r of results.filter((r) => !r.ok)) console.log(`[${r.group}] ${r.name} -> ${r.info}`);
console.log('\n=== Phản hồi 500 ===');
console.log(seen500.length ? seen500.join('\n') : '(không có)');
const endpoints = new Set(results.map((r) => r.name.split(' → ')[0].replace(/\?.*/, '')).filter((n) => /^(GET|POST|PUT|DELETE) \//.test(n)));
console.log(`\nTổng: ${results.filter((r) => r.ok).length}/${results.length} kiểm tra pass, ${endpoints.size} endpoint khác nhau được gọi`);
process.exit(results.every((r) => r.ok) && seen500.length === 0 ? 0 : 1);
