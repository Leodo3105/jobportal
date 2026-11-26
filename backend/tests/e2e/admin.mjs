// Khu admin: quản lý người dùng (khoá/mở), tin (nổi bật, xoá kèm đơn), công ty (gói dịch vụ),
// và lỗi NoSQL injection ở đăng nhập/đăng ký.
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
const api = async (method, url, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + url, { method, headers, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};
const fileForm = (field, name, type, bytes) => {
  const f = new FormData();
  f.append(field, new Blob([bytes], { type }), name);
  return f;
};

const preexisting = new Set(
  ['cv', 'logos', 'avatars'].flatMap((d) => fs.readdirSync(path.join(BE, 'uploads', d)).map((f) => `${d}/${f}`))
);
await mongoose.connect(MONGO);

const P = 'Passw0rd!';
const register = async (name, role) =>
  (await api('POST', '/api/auth/register', { json: { name, email: `${name}@t.io`, password: P, role } })).data.token;

const E = await register('emp', 'employer');
const J = await register('seeker', 'jobseeker');
const victim = await register('victim', 'jobseeker');
execFileSync('node', ['scripts/createAdmin.js', 'admin@t.io', P, 'Admin'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO } });
execFileSync('node', ['scripts/createAdmin.js', 'admin2@t.io', P, 'Admin2'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO } });
const A = (await api('POST', '/api/auth/login', { json: { email: 'admin@t.io', password: P } })).data.token;
check('Chuẩn bị: có token admin', Boolean(A));

// ---------- NoSQL injection ở đăng nhập/đăng ký ----------
const injLogin = await api('POST', '/api/auth/login', { json: { email: { $regex: '^admin' }, password: P } });
check('Đăng nhập với email là object ($regex) bị từ chối', injLogin.status === 400 && !injLogin.data.token, `status ${injLogin.status}`);
const injLogin2 = await api('POST', '/api/auth/login', { json: { email: { $ne: null }, password: P } });
check('Đăng nhập với email { $ne: null } bị từ chối', injLogin2.status === 400 && !injLogin2.data.token, `status ${injLogin2.status}`);
const injRegister = await api('POST', '/api/auth/register', { json: { name: 'x', email: { $ne: null }, password: P, role: 'jobseeker' } });
check('Đăng ký với email là object trả 400', injRegister.status === 400, `status ${injRegister.status}`);
const injForgot = await api('POST', '/api/auth/forgot-password', { json: { email: { $ne: null } } });
check('Quên mật khẩu với email là object trả 400 (không 500)', injForgot.status === 400, `status ${injForgot.status}`);

// ---------- Quyền ----------
for (const [who, token] of [['ứng viên', J], ['NTD', E], ['chưa đăng nhập', null]]) {
  const r = await api('GET', '/api/admin/users', { token });
  check(`${who} không vào được /api/admin/users`, r.status === (token ? 403 : 401), `status ${r.status}`);
}

// ---------- Người dùng ----------
const users = await api('GET', '/api/admin/users', { token: A });
check('Admin xem danh sách người dùng', users.status === 200 && users.data.total >= 5 && typeof users.data.totalPages === 'number', `total ${users.data.total}`);
check('Danh sách người dùng không lộ mật khẩu', !JSON.stringify(users.data).includes('password'));
const search = await api('GET', '/api/admin/users?search=victim', { token: A });
check('Tìm người dùng theo tên/email', search.data.total === 1 && search.data.data[0].email === 'victim@t.io', `total ${search.data.total}`);
const byRole = await api('GET', '/api/admin/users?role=employer', { token: A });
check('Lọc người dùng theo vai trò', byRole.data.data.every((u) => u.role === 'employer') && byRole.data.total === 1, `total ${byRole.data.total}`);
const inj = await api('GET', '/api/admin/users?role[$ne]=x', { token: A });
check('?role[$ne]= không thành toán tử MongoDB', inj.status === 200 && inj.data.total === users.data.total, `total ${inj.data.total}`);

const victimId = search.data.data[0]._id;
const adminId = (await api('GET', '/api/auth/me', { token: A })).data.data.id;
const admin2Id = (await api('GET', '/api/admin/users?search=admin2', { token: A })).data.data[0]._id;

const lock = await api('PUT', `/api/admin/users/${victimId}/status`, { token: A, json: { isActive: false } });
check('Admin khoá tài khoản', lock.status === 200 && lock.data.data?.isActive === false, `status ${lock.status}`);
const lockedMe = await api('GET', '/api/auth/me', { token: victim });
check('Tài khoản bị khoá: token đang có bị từ chối', lockedMe.status === 401 || lockedMe.status === 403, `status ${lockedMe.status}`);
const lockedLogin = await api('POST', '/api/auth/login', { json: { email: 'victim@t.io', password: P } });
check('Tài khoản bị khoá không đăng nhập được (403, có lý do)', lockedLogin.status === 403 && !lockedLogin.data.token && /khoá/.test(lockedLogin.data.error), `status ${lockedLogin.status}`);
const wrongPwLocked = await api('POST', '/api/auth/login', { json: { email: 'victim@t.io', password: 'Wrong123!' } });
check('Sai mật khẩu thì không lộ là tài khoản bị khoá (vẫn 401)', wrongPwLocked.status === 401, `status ${wrongPwLocked.status}`);
const lockedList = await api('GET', '/api/admin/users?status=locked', { token: A });
check('Lọc tài khoản bị khoá', lockedList.data.total === 1 && lockedList.data.data[0]._id === victimId, `total ${lockedList.data.total}`);

const unlock = await api('PUT', `/api/admin/users/${victimId}/status`, { token: A, json: { isActive: true } });
const reLogin = await api('POST', '/api/auth/login', { json: { email: 'victim@t.io', password: P } });
check('Mở khoá thì đăng nhập lại được', unlock.status === 200 && reLogin.status === 200, `${unlock.status}/${reLogin.status}`);
const oldTokenAfterUnlock = await api('GET', '/api/auth/me', { token: victim });
check('Token cũ (trước khi bị khoá) vẫn không dùng lại được sau khi mở khoá', oldTokenAfterUnlock.status === 401, `status ${oldTokenAfterUnlock.status}`);

const lockSelf = await api('PUT', `/api/admin/users/${adminId}/status`, { token: A, json: { isActive: false } });
check('Admin không tự khoá mình', lockSelf.status === 400, `status ${lockSelf.status}`);
const lockAdmin = await api('PUT', `/api/admin/users/${admin2Id}/status`, { token: A, json: { isActive: false } });
check('Admin không khoá admin khác', lockAdmin.status === 403, `status ${lockAdmin.status}`);
const badBody = await api('PUT', `/api/admin/users/${victimId}/status`, { token: A, json: { isActive: 'no' } });
check('isActive không phải boolean trả 400', badBody.status === 400, `status ${badBody.status}`);
const badId = await api('PUT', '/api/admin/users/abc/status', { token: A, json: { isActive: false } });
check('Id người dùng sai định dạng trả 400', badId.status === 400, `status ${badId.status}`);

// ---------- Tin tuyển dụng ----------
await api('POST', '/api/companies', { token: E, json: { name: 'ACME', description: 'Công ty phần mềm', industry: 'IT', location: 'HN' } });
const companyId = (await api('GET', '/api/companies', { token: E })).data.data._id;
const jobBody = { title: 'Dev', description: 'd', requirements: 'r', benefits: 'b', location: 'HN', jobType: 'full-time', category: 'IT', applicationDeadline: '2030-01-01' };
const jobId = (await api('POST', '/api/jobs', { token: E, json: jobBody })).data.data._id;
const job2Id = (await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Tester' } })).data.data._id;
await api('PUT', `/api/jobs/${job2Id}/status`, { token: E, json: { status: 'draft' } });

const adminJobs = await api('GET', '/api/admin/jobs', { token: A });
check('Admin thấy cả tin nháp', adminJobs.status === 200 && adminJobs.data.total === 2, `total ${adminJobs.data.total}`);
check('Danh sách tin có tên công ty và email NTD', adminJobs.data.data[0]?.company?.name === 'ACME' && adminJobs.data.data[0]?.user?.email === 'emp@t.io');
const draftOnly = await api('GET', '/api/admin/jobs?status=draft', { token: A });
check('Lọc tin theo trạng thái', draftOnly.data.total === 1 && draftOnly.data.data[0]._id === job2Id, `total ${draftOnly.data.total}`);

const feat = await api('PUT', `/api/admin/jobs/${jobId}/featured`, { token: A, json: { featured: true } });
const pub = await api('GET', `/api/jobs/${jobId}`);
check('Admin đánh dấu tin nổi bật', feat.status === 200 && pub.data.data?.featured === true, `${feat.status}`);
const featByEmp = await api('PUT', `/api/admin/jobs/${jobId}/featured`, { token: E, json: { featured: false } });
check('NTD không tự đánh dấu nổi bật qua API admin', featByEmp.status === 403, `status ${featByEmp.status}`);

const adminClose = await api('PUT', `/api/jobs/${jobId}/status`, { token: A, json: { status: 'closed' } });
check('Admin đổi trạng thái tin của NTD', adminClose.status === 200 && adminClose.data.data?.status === 'closed', `status ${adminClose.status}`);
await api('PUT', `/api/jobs/${jobId}/status`, { token: A, json: { status: 'active' } });

// Xoá tin kèm đơn và file CV
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
await api('POST', '/api/profiles', { token: J, json: { title: 'Dev' } });
const form = fileForm('cv', 'cv.pdf', 'application/pdf', pdf);
form.append('jobId', jobId);
const applied = await api('POST', '/api/applications/apply', { token: J, form });
const attached = applied.data.data?.attachedCV;
await api('POST', `/api/saved-jobs/${jobId}`, { token: J });
const cvPath = path.join(BE, 'uploads', 'cv', attached ?? 'none');
check('Chuẩn bị: có đơn kèm file CV riêng', applied.status === 201 && fs.existsSync(cvPath), `status ${applied.status}`);
const del = await api('DELETE', `/api/jobs/${jobId}`, { token: A });
const appsLeft = await mongoose.connection.db.collection('applications').countDocuments({ job: new mongoose.Types.ObjectId(jobId) });
const savedLeft = await mongoose.connection.db.collection('savedjobs').countDocuments({ job: new mongoose.Types.ObjectId(jobId) });
check('Admin xoá tin: đơn và tin đã lưu bị xoá theo', del.status === 200 && appsLeft === 0 && savedLeft === 0, `${del.status} apps=${appsLeft} saved=${savedLeft}`);
check('Xoá tin: file CV chỉ đơn đó dùng cũng bị xoá', !fs.existsSync(cvPath));
const myApps = await api('GET', '/api/applications/user/myapplications', { token: J });
check('Ứng viên không còn đơn mồ côi trỏ tới tin đã xoá', myApps.status === 200 && myApps.data.count === 0, `count ${myApps.data.count}`);

// ---------- Công ty và gói dịch vụ ----------
const companies = await api('GET', '/api/admin/companies', { token: A });
const c0 = companies.data.data?.[0];
check('Admin xem công ty kèm gói, chủ tài khoản, số tin', companies.status === 200 && c0?.subscription?.type === 'free' && c0?.user?.email === 'emp@t.io' && c0?.jobCount === 1,
  JSON.stringify({ plan: c0?.subscription?.type, owner: c0?.user?.email, jobs: c0?.jobCount }));

const noEnd = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'premium' } });
check('Gói trả phí thiếu ngày hết hạn trả 400', noEnd.status === 400, `status ${noEnd.status}`);
const pastEnd = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'premium', endDate: '2020-01-01' } });
check('Ngày hết hạn ở quá khứ trả 400', pastEnd.status === 400, `status ${pastEnd.status}`);
const badPlan = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'gold', endDate: '2030-01-01' } });
check('Gói không tồn tại trả 400', badPlan.status === 400, `status ${badPlan.status}`);

const premium = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'premium', endDate: '2030-01-01' } });
const jobsAfterPremium = await mongoose.connection.db.collection('jobs').find({ company: new mongoose.Types.ObjectId(companyId) }).toArray();
check('Gói premium: công ty và mọi tin thành nổi bật', premium.status === 200 && premium.data.data?.featured === true && jobsAfterPremium.every((j) => j.featured === true),
  `${premium.status} jobs=${jobsAfterPremium.map((j) => j.featured).join(',')}`);
const publicCompany = await api('GET', `/api/companies/${companyId}`);
check('API công khai vẫn không lộ gói dịch vụ', publicCompany.data.data?.featured === true && !('subscription' in publicCompany.data.data));
// Tin đăng SAU khi lên gói cũng phải nổi bật (trước đây createJob không xét gói)
const premiumJob = await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Tin đăng khi premium' } });
check('Gói premium: tin mới đăng cũng nổi bật', premiumJob.status === 201 && premiumJob.data.data?.featured === true,
  `${premiumJob.status} featured=${premiumJob.data.data?.featured}`);
// Xoá ngay để không làm lệch các số đếm tin phía sau
await api('DELETE', `/api/jobs/${premiumJob.data.data?._id}`, { token: E });

const free = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'free' } });
const jobsAfterFree = await mongoose.connection.db.collection('jobs').find({ company: new mongoose.Types.ObjectId(companyId) }).toArray();
check('Về gói free: bỏ nổi bật công ty và tin', free.status === 200 && free.data.data?.featured === false && jobsAfterFree.every((j) => j.featured === false));
const freeJob = await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Tin đăng khi free', featured: true } });
check('Gói free: tin mới không nổi bật, kể cả khi body gửi featured: true', freeJob.status === 201 && freeJob.data.data?.featured === false,
  `${freeJob.status} featured=${freeJob.data.data?.featured}`);
await api('DELETE', `/api/jobs/${freeJob.data.data?._id}`, { token: E });
const premiumList = await api('GET', '/api/admin/companies?plan=free', { token: A });
check('Lọc công ty theo gói', premiumList.data.total === 1, `total ${premiumList.data.total}`);
const subByEmp = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: E, json: { type: 'enterprise', endDate: '2030-01-01' } });
check('NTD không tự nâng gói', subByEmp.status === 403, `status ${subByEmp.status}`);

// ---------- Trang tổng quan ----------
const dash = await api('GET', '/api/dashboard/admin', { token: A });
const d = dash.data.data;
const nowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
check('Tổng quan: đếm người dùng theo vai trò, có số bị khoá', dash.status === 200 && d.users.total === 5 && d.users.admins === 2 && d.users.employers === 1 && typeof d.users.locked === 'number',
  JSON.stringify(d?.users));
check('Tổng quan: 6 tháng, tháng cuối là tháng hiện tại (giờ VN), dạng yyyy-MM', d.charts.labels.length === 6 && d.charts.labels.at(-1) === nowKey && new Set(d.charts.labels).size === 6,
  d.charts.labels.join(','));
check('Tổng quan: người dùng mới tháng này được đếm', d.charts.datasets.newUsers.at(-1) === 5, `${d.charts.datasets.newUsers.at(-1)}`);
check('Tổng quan: hồ sơ không có field cvFile không bị đếm là "có CV"', d.profiles.total === 1 && d.profiles.withCV === 0, JSON.stringify(d.profiles));
check('Tổng quan: có số tin đang hiện (active còn hạn)', typeof d.jobs.open === 'number' && d.jobs.open <= d.jobs.active, JSON.stringify(d.jobs));

// ---------- Danh mục ----------
const it = (await api('POST', '/api/categories', { token: A, json: { name: 'IT', type: 'industry' } })).data.data?._id;
const catList = await api('GET', '/api/admin/categories', { token: A });
const itRow = catList.data.data?.find((c) => c._id === it);
check('Admin xem danh mục kèm số tin/công ty đang dùng', catList.status === 200 && itRow?.jobCount === 1 && itRow?.companyCount === 1, JSON.stringify(itRow));
const catByEmp = await api('GET', '/api/admin/categories', { token: E });
check('NTD không xem được danh mục qua API admin', catByEmp.status === 403, `status ${catByEmp.status}`);

const objName = await api('POST', '/api/categories', { token: A, json: { name: { $ne: null }, type: 'industry' } });
check('Tạo danh mục với tên là object trả 400 (không 500)', objName.status === 400, `status ${objName.status}`);
const longName = await api('POST', '/api/categories', { token: A, json: { name: 'a'.repeat(101), type: 'industry' } });
check('Tên danh mục quá dài trả 400', longName.status === 400, `status ${longName.status}`);
const badActive = await api('PUT', `/api/categories/${it}`, { token: A, json: { active: 'yes' } });
check('active không phải boolean trả 400', badActive.status === 400, `status ${badActive.status}`);

const delUsed = await api('DELETE', `/api/categories/${it}`, { token: A });
check('Không xoá được ngành đang có tin/công ty dùng', delUsed.status === 400 && /1 tin và 1 công ty/.test(delUsed.data.error), delUsed.data.error);

const rename = await api('PUT', `/api/categories/${it}`, { token: A, json: { name: 'Công nghệ' } });
const jobAfter = await mongoose.connection.db.collection('jobs').findOne({ _id: new mongoose.Types.ObjectId(job2Id) });
const companyAfter = await mongoose.connection.db.collection('companies').findOne({ _id: new mongoose.Types.ObjectId(companyId) });
check('Đổi tên ngành: tin và công ty đổi theo', rename.status === 200 && jobAfter.category === 'Công nghệ' && companyAfter.industry === 'Công nghệ' && rename.data.renamed?.jobs === 1,
  JSON.stringify({ status: rename.status, job: jobAfter?.category, company: companyAfter?.industry, renamed: rename.data.renamed }));

const hide = await api('PUT', `/api/categories/${it}`, { token: A, json: { active: false } });
const publicActive = await api('GET', '/api/categories/type/industry?active=true');
check('Ẩn ngành: không còn trong danh sách ngành đang dùng', hide.status === 200 && !publicActive.data.data.some((c) => c._id === it));
const allForAdmin = await api('GET', '/api/admin/categories?type=industry', { token: A });
check('Admin vẫn thấy ngành đã ẩn', allForAdmin.data.data.some((c) => c._id === it && c.active === false));

// ---------- Xoá tài khoản ----------
// NTD có công ty + logo + tin; ứng viên có đơn kèm file CV riêng vào tin đó
const E3 = await register('emp3', 'employer');
const J3 = await register('seeker3', 'jobseeker');
await api('POST', '/api/companies', { token: E3, json: { name: 'Xoá Corp', description: 'Sẽ bị xoá', industry: 'Công nghệ', location: 'HN' } });
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const logoUp = await api('PUT', '/api/companies/logo', { token: E3, form: fileForm('logo', 'logo.png', 'image/png', png) });
const e3Job = (await api('POST', '/api/jobs', { token: E3, json: { ...jobBody, category: 'Công nghệ', title: 'Tin sẽ bị xoá' } })).data.data._id;
const cvForm = fileForm('cv', 'cv.pdf', 'application/pdf', pdf);
cvForm.append('jobId', e3Job);
const j3Apply = await api('POST', '/api/applications/apply', { token: J3, form: cvForm });
check('Chuẩn bị xoá: có logo, tin và đơn kèm CV', logoUp.status === 200 && Boolean(e3Job) && j3Apply.status === 201,
  JSON.stringify({ logo: logoUp.status, apply: j3Apply.status }));
const e3Id = (await api('GET', '/api/admin/users?search=emp3', { token: A })).data.data[0]._id;
const e3Company = await mongoose.connection.db.collection('companies').findOne({ user: new mongoose.Types.ObjectId(e3Id) });
const j3Cv = (await mongoose.connection.db.collection('applications').findOne({ job: new mongoose.Types.ObjectId(e3Job) }))?.attachedCV;

const delByEmp = await api('DELETE', `/api/admin/users/${e3Id}`, { token: E });
check('NTD không gọi được API xoá tài khoản', delByEmp.status === 403, `status ${delByEmp.status}`);
const delSelf = await api('DELETE', `/api/admin/users/${adminId}`, { token: A });
check('Admin không tự xoá mình qua API admin', delSelf.status === 400, `status ${delSelf.status}`);
const delAdmin = await api('DELETE', `/api/admin/users/${admin2Id}`, { token: A });
check('Admin không xoá được admin khác', delAdmin.status === 403, `status ${delAdmin.status}`);
const delBadId = await api('DELETE', '/api/admin/users/abc', { token: A });
check('Xoá với id sai định dạng trả 400', delBadId.status === 400, `status ${delBadId.status}`);
const delMissing = await api('DELETE', '/api/admin/users/000000000000000000000000', { token: A });
check('Xoá người dùng không tồn tại trả 404', delMissing.status === 404, `status ${delMissing.status}`);

const delE3 = await api('DELETE', `/api/admin/users/${e3Id}`, { token: A });
const db = mongoose.connection.db;
check('Admin xoá NTD: trả số tin và đơn đã xoá', delE3.status === 200 && delE3.data.data?.deleted?.jobs === 1 && delE3.data.data.deleted.jobApplications === 1 && delE3.data.data.deleted.company === true,
  JSON.stringify(delE3.data));
check('Xoá NTD: user, công ty, tin, đơn của tin đều mất',
  !(await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(e3Id) }))
  && !(await db.collection('companies').findOne({ _id: e3Company._id }))
  && !(await db.collection('jobs').findOne({ _id: new mongoose.Types.ObjectId(e3Job) }))
  && (await db.collection('applications').countDocuments({ job: new mongoose.Types.ObjectId(e3Job) })) === 0);
check('Xoá NTD: file logo và CV không còn dùng bị xoá khỏi ổ đĩa',
  Boolean(e3Company.logo) && !fs.existsSync(path.join(BE, 'uploads', 'logos', e3Company.logo))
  && Boolean(j3Cv) && !fs.existsSync(path.join(BE, 'uploads', 'cv', j3Cv)),
  JSON.stringify({ logo: e3Company.logo, cv: j3Cv }));
const meAfterDelete = await api('GET', '/api/auth/me', { token: E3 });
check('Token của tài khoản đã xoá không dùng được nữa', meAfterDelete.status === 401, `status ${meAfterDelete.status}`);
check('Ứng viên từng nộp đơn vẫn còn', (await api('GET', '/api/auth/me', { token: J3 })).status === 200);

const j3Id = (await api('GET', '/api/admin/users?search=seeker3', { token: A })).data.data[0]._id;
const delJ3 = await api('DELETE', `/api/admin/users/${j3Id}`, { token: A });
check('Admin xoá ứng viên', delJ3.status === 200 && delJ3.data.data?.deleted?.jobs === 0, `status ${delJ3.status}`);
const delAgain = await api('DELETE', `/api/admin/users/${j3Id}`, { token: A });
check('Xoá lần hai trả 404', delAgain.status === 404, `status ${delAgain.status}`);

await mongoose.connection.dropDatabase();
await mongoose.disconnect();
for (const dir of ['cv', 'logos', 'avatars']) {
  for (const f of fs.readdirSync(path.join(BE, 'uploads', dir))) {
    if (!preexisting.has(`${dir}/${f}`)) fs.unlinkSync(path.join(BE, 'uploads', dir, f));
  }
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
