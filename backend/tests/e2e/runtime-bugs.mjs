// End-to-end checks for "Bước 2" against a running server on a throwaway DB.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const BE = process.argv[2];
const BASE = process.argv[3];
const MONGO = process.argv[4];
const require = createRequire(path.join(BE, 'package.json'));
const mongoose = require('mongoose');

// Ngành của công ty/tin phải có trong danh mục. Bộ này không có admin nên ghi thẳng ngành "IT" vào DB test.
{
  const conn = await mongoose.createConnection(MONGO).asPromise();
  await conn.collection('categories').insertOne({ name: 'IT', slug: 'it', type: 'industry', active: true });
  await conn.close();
}

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

const preexistingCV = new Set(fs.readdirSync(path.join(BE, 'uploads/cv')));
const P = 'Passw0rd!';
const reg = async (name, role) =>
  (await api('POST', '/api/auth/register', { json: { name, email: `${name}@t.io`, password: P, role } })).data.token;

const E = await reg('emp', 'employer');
const E2 = await reg('emp2', 'employer');
const J = await reg('seeker', 'jobseeker');
const company = { name: 'ACME', description: 'd', industry: 'IT', location: 'HN' };
await api('POST', '/api/companies', { token: E, json: company });
await api('POST', '/api/companies', { token: E2, json: { ...company, name: 'Other' } });
const jpg = fs.readFileSync(path.join(BE, 'src/assets/defaults/default-avatar.jpg'));
const png = fs.readFileSync(path.join(BE, 'src/assets/defaults/default-company-logo.png'));
await api('PUT', '/api/companies/logo', { token: E, form: fileForm('logo', 'l.png', 'image/png', png) });

// 3. password hook: login still works after a non-password save (avatar update)
const av = await api('PUT', '/api/profiles/avatar', { token: J, form: fileForm('avatar', 'a.jpg', 'image/jpeg', jpg) });
const relog = await api('POST', '/api/auth/login', { json: { email: 'seeker@t.io', password: P } });
check('Đăng nhập lại sau khi đổi avatar', av.status === 200 && relog.status === 200, `avatar ${av.status}, login ${relog.status}`);

// 5. createJob without skills
const jobBody = { title: 'Dev', description: 'd', requirements: 'r', benefits: 'b', location: 'HN', jobType: 'full-time', category: 'IT', applicationDeadline: '2030-01-01' };
const job = await api('POST', '/api/jobs', { token: E, json: jobBody });
check('Tạo job khi thiếu skills', job.status === 201 && Array.isArray(job.data.data?.skills) && job.data.data.skills.length === 0, `status ${job.status}`);
const jobId = job.data.data?._id;
const job2 = await api('POST', '/api/jobs', { token: E, json: { ...jobBody, skills: ' js, , node ' } });
check('skills dạng chuỗi được tách đúng', JSON.stringify(job2.data.data?.skills) === '["js","node"]', JSON.stringify(job2.data.data?.skills));

// apply
await api('POST', '/api/profiles', { token: J, json: { title: 'Dev' } });
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
const cv1 = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'CV Nguyễn.pdf', 'application/pdf', pdf) });
const cv1Name = cv1.data.data?.fileName;
const app = await api('POST', '/api/applications/apply', { token: J, json: { jobId } });
const appId = app.data.data?._id;
check('Ứng tuyển', app.status === 201, `status ${app.status}`);

// 2. application details
const dJ = await api('GET', `/api/applications/${appId}`, { token: J });
check('Ứng viên xem chi tiết đơn của mình', dJ.status === 200, `status ${dJ.status}`);
const dE = await api('GET', `/api/applications/${appId}`, { token: E });
check('Nhà tuyển dụng xem chi tiết đơn', dE.status === 200 && dE.data.data?.status === 'viewed', `status ${dE.status}, app status ${dE.data.data?.status}`);
const dE2 = await api('GET', `/api/applications/${appId}`, { token: E2 });
check('NTD khác không xem được đơn (403)', dE2.status === 403, `status ${dE2.status}`);

// 6. replacing CV keeps the file used by the application
const cv2 = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'new.pdf', 'application/pdf', pdf) });
const oldStillThere = fs.existsSync(path.join(BE, 'uploads/cv', cv1Name));
const appCv = await api('GET', `/api/applications/${appId}/cv`, { token: E });
check('Đổi CV không xoá file CV mà đơn cũ đang dùng', cv2.status === 200 && oldStillThere && appCv.status === 200, `file còn: ${oldStillThere}, tải CV đơn: ${appCv.status}`);
const cv2Name = cv2.data.data?.fileName;
await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'third.pdf', 'application/pdf', pdf) });
check('CV cũ không ai dùng thì vẫn bị xoá', !fs.existsSync(path.join(BE, 'uploads/cv', cv2Name)));

// 1. messages
const me = (await api('GET', '/api/auth/me', { token: E })).data.data;
const msg = await api('POST', '/api/messages', { token: J, json: { receiverId: String(me.id), content: 'Xin chào' } });
const notis = await api('GET', '/api/notifications', { token: E });
const hasMsgNoti = JSON.stringify(notis.data).includes('"type":"message"');
check('Gửi tin nhắn', msg.status === 201 && hasMsgNoti, `status ${msg.status}, có thông báo: ${hasMsgNoti}`);

// 8. malformed ids
for (const [url, token] of [['/api/jobs/abc', null], ['/api/applications/xyz', J], ['/api/categories/123', null], ['/api/messages/conversation/nope', J], ['/api/companies/zzz', null]]) {
  const r = await api('GET', url, { token });
  check(`Id sai ${url} trả 400`, r.status === 400, `status ${r.status}`);
}
const okMissing = await api('GET', '/api/jobs/' + new mongoose.Types.ObjectId(), {});
check('Id đúng định dạng nhưng không tồn tại trả 404', okMissing.status === 404, `status ${okMissing.status}`);

// 9. upload errors
const doc = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'cv.doc', 'application/msword', pdf) });
check('Upload CV .doc được chấp nhận', doc.status === 200, `status ${doc.status}`);
const exe = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'x.exe', 'application/octet-stream', pdf) });
check('Upload file .exe bị từ chối 400', exe.status === 400, `status ${exe.status} ${JSON.stringify(exe.data)}`);
const wrongField = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('file', 'cv.pdf', 'application/pdf', pdf) });
check('Sai tên field upload trả 400', wrongField.status === 400, `status ${wrongField.status} ${JSON.stringify(wrongField.data)}`);
const big = await api('PUT', '/api/cv/upload', { token: J, form: fileForm('cv', 'big.pdf', 'application/pdf', Buffer.alloc(5_100_000)) });
check('File quá 5MB trả 400', big.status === 400, `status ${big.status} ${JSON.stringify(big.data)}`);

// 4 + 7. delete employer account -> cascade, token of deleted user -> 401
await mongoose.connect(MONGO);
const db = mongoose.connection.db;
const empUser = await db.collection('users').findOne({ email: 'emp@t.io' });
const empCompany = await db.collection('companies').findOne({ user: empUser._id });
const del = await api('DELETE', '/api/auth/me', { token: E, json: { password: P } });
const left = {
  user: await db.collection('users').countDocuments({ _id: empUser._id }),
  company: await db.collection('companies').countDocuments({ user: empUser._id }),
  jobs: await db.collection('jobs').countDocuments({ user: empUser._id }),
  apps: await db.collection('applications').countDocuments({ job: new mongoose.Types.ObjectId(jobId) }),
  notis: await db.collection('notifications').countDocuments({ user: empUser._id }),
  msgs: await db.collection('messages').countDocuments({ $or: [{ sender: empUser._id }, { receiver: empUser._id }] })
};
const logoGone = !fs.existsSync(path.join(BE, 'uploads/logos', empCompany.logo));
check('Xoá tài khoản NTD', del.status === 200 && Object.values(left).every((n) => n === 0) && logoGone,
  `status ${del.status}, còn lại ${JSON.stringify(left)}, logo đã xoá: ${logoGone}`);
const cv1Gone = !fs.existsSync(path.join(BE, 'uploads/cv', cv1Name));
check('CV của đơn bị xoá theo khi không còn đơn nào dùng', cv1Gone);
const after = await api('GET', '/api/auth/me', { token: E });
check('Token của tài khoản đã xoá trả 401', after.status === 401, `status ${after.status}`);

const seeker = await db.collection('users').findOne({ email: 'seeker@t.io' });
const delJ = await api('DELETE', '/api/auth/me', { token: J, json: { password: P } });
const leftJ = {
  user: await db.collection('users').countDocuments({ _id: seeker._id }),
  profile: await db.collection('jobseekerprofiles').countDocuments({ user: seeker._id }),
  apps: await db.collection('applications').countDocuments({ user: seeker._id })
};
const cvLeft = fs.readdirSync(path.join(BE, 'uploads/cv')).filter((f) => !preexistingCV.has(f)).length;
const avLeft = fs.readdirSync(path.join(BE, 'uploads/avatars')).filter((f) => f !== 'default-avatar.jpg').length;
check('Xoá tài khoản ứng viên', delJ.status === 200 && Object.values(leftJ).every((n) => n === 0) && cvLeft === 0 && avLeft === 0,
  `status ${delJ.status}, còn lại ${JSON.stringify(leftJ)}, file cv ${cvLeft}, avatar ${avLeft}`);

await mongoose.connection.dropDatabase();
await mongoose.disconnect();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
