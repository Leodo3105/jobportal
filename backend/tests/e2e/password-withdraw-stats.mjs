// End-to-end checks for "Bước 4" (4.1 forgot/reset password, 4.2 withdraw, 4.3 company stats).
import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const [BE, BASE, MONGO, SERVER_LOG] = process.argv.slice(2);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Read the newest reset link the server printed for an email
const latestResetToken = async (email) => {
  await sleep(300);
  const lines = fs.readFileSync(SERVER_LOG, 'utf8').split('\n').filter((l) => l.includes(`cho ${email}:`));
  const m = lines.at(-1)?.match(/token=([a-f0-9]+)/);
  return m?.[1];
};

const preexisting = new Set(
  ['cv', 'logos', 'avatars'].flatMap((d) => fs.readdirSync(path.join(BE, 'uploads', d)).map((f) => `${d}/${f}`))
);
await mongoose.connect(MONGO);
const users = mongoose.connection.db.collection('users');

const P = 'Passw0rd!';
const NEWP = 'NewPassw0rd#';
const register = async (name, role) =>
  (await api('POST', '/api/auth/register', { json: { name, email: `${name}@t.io`, password: P, role } })).data.token;
const E = await register('emp', 'employer');
let J = await register('seeker', 'jobseeker'); // let: đặt lại mật khẩu xong phải dùng token mới
const J2 = await register('seeker2', 'jobseeker');

// ---------- 4.1 forgot / reset password ----------
const fExist = await api('POST', '/api/auth/forgot-password', { json: { email: 'seeker@t.io' } });
const fNone = await api('POST', '/api/auth/forgot-password', { json: { email: 'nobody@t.io' } });
check('Quên MK: email có và không có trả giống nhau',
  fExist.status === 200 && fNone.status === 200 && JSON.stringify(fExist.data) === JSON.stringify(fNone.data),
  `${fExist.status}/${fNone.status}`);
const fEmpty = await api('POST', '/api/auth/forgot-password', { json: {} });
check('Quên MK: thiếu email trả 400', fEmpty.status === 400, `status ${fEmpty.status}`);

const raw = await latestResetToken('seeker@t.io');
const stored = (await users.findOne({ email: 'seeker@t.io' })).resetPasswordToken;
check('Token in ra console, DB chỉ lưu bản băm SHA-256',
  Boolean(raw) && stored !== raw && stored === crypto.createHash('sha256').update(raw).digest('hex'));

const weak = await api('POST', '/api/auth/reset-password', { json: { token: raw, password: 'weak' } });
check('Đặt lại MK yếu trả 400', weak.status === 400, weak.data.error);
const reset = await api('POST', '/api/auth/reset-password', { json: { token: raw, password: NEWP } });
check('Đặt lại MK thành công, không trả token đăng nhập', reset.status === 200 && !reset.data.token && Boolean(reset.data.message), `status ${reset.status}`);
const loginNew = await api('POST', '/api/auth/login', { json: { email: 'seeker@t.io', password: NEWP } });
const loginOld = await api('POST', '/api/auth/login', { json: { email: 'seeker@t.io', password: P } });
check('Đăng nhập bằng MK mới được, MK cũ không', loginNew.status === 200 && loginOld.status === 401, `${loginNew.status}/${loginOld.status}`);
const oldTokenAfterReset = await api('GET', '/api/auth/me', { token: J });
check('Đặt lại MK xong, token đăng nhập cũ hết hiệu lực', oldTokenAfterReset.status === 401, `status ${oldTokenAfterReset.status}`);
J = loginNew.data.token;
const reuse = await api('POST', '/api/auth/reset-password', { json: { token: raw, password: 'Another1!' } });
check('Dùng lại token lần 2 trả 400', reuse.status === 400, `status ${reuse.status}`);

await api('POST', '/api/auth/forgot-password', { json: { email: 'seeker2@t.io' } });
const raw2 = await latestResetToken('seeker2@t.io');
await users.updateOne({ email: 'seeker2@t.io' }, { $set: { resetPasswordExpire: new Date(Date.now() - 1000) } });
const expired = await api('POST', '/api/auth/reset-password', { json: { token: raw2, password: NEWP } });
check('Token hết hạn trả 400', expired.status === 400, `status ${expired.status}`);
const garbage = await api('POST', '/api/auth/reset-password', { json: { token: 'abc', password: NEWP } });
check('Token bịa trả 400', garbage.status === 400, `status ${garbage.status}`);

// ---------- 4.2 withdraw ----------
const companyRes = await api('POST', '/api/companies', { token: E, json: { name: 'ACME', description: 'd', industry: 'IT', location: 'HN' } });
const jobBody = { title: 'Dev', description: 'd', requirements: 'r', benefits: 'b', location: 'HN', jobType: 'full-time', category: 'IT', applicationDeadline: '2030-01-01' };
const jobRes = await api('POST', '/api/jobs', { token: E, json: jobBody });
// In rõ lý do nếu bước chuẩn bị thất bại, thay vì lỗi "Cannot read properties of undefined"
if (!jobRes.data?.data?._id) {
  console.log('Chuẩn bị dữ liệu thất bại:', JSON.stringify({ company: [companyRes.status, companyRes.data], job: [jobRes.status, jobRes.data] }));
  process.exit(1);
}
const jobId = jobRes.data.data._id;
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
for (const t of [J, J2]) {
  await api('POST', '/api/profiles', { token: t, json: { title: 'Dev' } });
  await api('PUT', '/api/cv/upload', { token: t, form: fileForm('cv', 'cv.pdf', 'application/pdf', pdf) });
}
const appId = (await api('POST', '/api/applications/apply', { token: J, json: { jobId, coverLetter: 'v1' } })).data.data._id;

const byOther = await api('PUT', `/api/applications/${appId}/cancel`, { token: J2 });
check('Ứng viên khác rút đơn trả 403', byOther.status === 403, `status ${byOther.status}`);
const byEmp = await api('PUT', `/api/applications/${appId}/cancel`, { token: E });
check('NTD gọi rút đơn trả 403', byEmp.status === 403, `status ${byEmp.status}`);
const cancel = await api('PUT', `/api/applications/${appId}/cancel`, { token: J });
check('Ứng viên rút đơn thành công', cancel.status === 200 && cancel.data.data?.status === 'withdrawn', `status ${cancel.status}`);
const notis = JSON.stringify((await api('GET', '/api/notifications', { token: E })).data);
check('NTD nhận thông báo rút đơn', notis.includes('đã rút đơn'));
const again = await api('PUT', `/api/applications/${appId}/cancel`, { token: J });
check('Rút lần 2 trả 400', again.status === 400, again.data.error);
const st = await api('PUT', `/api/applications/${appId}/status`, { token: E, json: { status: 'accepted' } });
check('NTD đổi trạng thái đơn đã rút trả 400', st.status === 400, `status ${st.status}`);
const iv = await api('PUT', `/api/applications/${appId}/schedule-interview`, { token: E, json: { date: '2030-01-01', location: 'HN', type: 'video' } });
check('NTD hẹn phỏng vấn đơn đã rút trả 400', iv.status === 400, `status ${iv.status}`);

const reapply = await api('POST', '/api/applications/apply', { token: J, json: { jobId, coverLetter: 'v2' } });
check('Nộp lại sau khi rút: đơn cũ quay về pending',
  reapply.status === 201 && reapply.data.data?._id === appId && reapply.data.data?.status === 'pending' && reapply.data.data?.coverLetter === 'v2',
  `status ${reapply.status}, id giữ nguyên: ${reapply.data.data?._id === appId}`);
const dup = await api('POST', '/api/applications/apply', { token: J, json: { jobId } });
check('Nộp trùng khi đơn đang hoạt động vẫn trả 400', dup.status === 400, `status ${dup.status}`);

await api('PUT', `/api/applications/${appId}/status`, { token: E, json: { status: 'accepted' } });
const cancelAccepted = await api('PUT', `/api/applications/${appId}/cancel`, { token: J });
check('Đơn đã accepted không rút được', cancelAccepted.status === 400, cancelAccepted.data.error);
const badId = await api('PUT', '/api/applications/xyz/cancel', { token: J });
check('Id sai khi rút đơn trả 400', badId.status === 400, `status ${badId.status}`);

// ---------- 4.3 company stats ----------
const app2 = (await api('POST', '/api/applications/apply', { token: J2, json: { jobId } })).data.data._id;
await api('PUT', `/api/applications/${app2}/cancel`, { token: J2 });
const job2 = (await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Closed one' } })).data.data._id;
await api('PUT', `/api/jobs/${job2}/status`, { token: E, json: { status: 'closed' } });

const stats = await api('GET', '/api/companies/stats', { token: E });
const s = stats.data.data;
check('Thống kê công ty trả đúng số liệu',
  stats.status === 200 &&
  s.jobStats.total === 2 && s.jobStats.active === 1 && s.jobStats.closed === 1 &&
  s.applicationStats.total === 2 && s.applicationStats.accepted === 1 && s.applicationStats.withdrawn === 1 &&
  s.applicationStats.pending === 0,
  JSON.stringify(s));
const statsJ = await api('GET', '/api/companies/stats', { token: J });
check('Ứng viên xem thống kê công ty trả 403', statsJ.status === 403, `status ${statsJ.status}`);

const dashE = (await api('GET', '/api/dashboard/employer', { token: E })).data;
const dashJ2 = (await api('GET', '/api/dashboard/jobseeker', { token: J2 })).data;
check('Dashboard NTD và ứng viên có số đơn đã rút',
  JSON.stringify(dashE).includes('"withdrawn":1') && JSON.stringify(dashJ2).includes('"withdrawn":1'));

// ---------- Nộp hồ sơ kèm file CV (form FE) ----------
const J3 = await register('seeker3', 'jobseeker'); // chưa có hồ sơ, chưa có CV
const job3 = (await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title: 'Apply form' } })).data.data._id;
const cvDir = path.join(BE, 'uploads', 'cv');
const applyForm = (fields, withFile = true) => {
  const f = withFile ? fileForm('cv', 'cv-rieng.pdf', 'application/pdf', pdf) : new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const noCv = await api('POST', '/api/applications/apply', { token: J3, form: applyForm({ jobId: job3 }, false) });
check('Chưa có CV và không gửi file trả 400', noCv.status === 400, noCv.data.error);

const withFile = await api('POST', '/api/applications/apply', { token: J3, form: applyForm({ jobId: job3, coverLetter: 'Xin chào' }) });
const j3Profile = (await api('GET', '/api/profiles', { token: J3 })).data.data;
check('Chưa có CV trong hồ sơ vẫn nộp được bằng file gửi kèm',
  withFile.status === 201 && withFile.data.data?.attachedCV?.startsWith('cv-') && withFile.data.data?.coverLetter === 'Xin chào',
  `status ${withFile.status} ${withFile.data.error ?? ''}`);
check('File gửi kèm không thành CV của hồ sơ', Boolean(j3Profile) && !j3Profile.cvFile, `cvFile=${j3Profile?.cvFile}`);

const cvCountBefore = fs.readdirSync(cvDir).length;
const dupFile = await api('POST', '/api/applications/apply', { token: J3, form: applyForm({ jobId: job3 }) });
check('Nộp trùng kèm file trả 400 và xoá file vừa upload',
  dupFile.status === 400 && fs.readdirSync(cvDir).length === cvCountBefore,
  `status ${dupFile.status}, file trước ${cvCountBefore} sau ${fs.readdirSync(cvDir).length}`);

const badJob = await api('POST', '/api/applications/apply', { token: J2, json: { jobId: 'abc' } });
check('jobId sai định dạng trả 400', badJob.status === 400, `status ${badJob.status}`);
const longLetter = await api('POST', '/api/applications/apply', { token: J2, json: { jobId: job3, coverLetter: 'a'.repeat(2001) } });
check('Thư giới thiệu quá 2000 ký tự trả 400', longLetter.status === 400, `status ${longLetter.status}`);

await mongoose.connection.dropDatabase();
await mongoose.disconnect();
for (const dir of ['cv', 'logos', 'avatars']) {
  for (const f of fs.readdirSync(path.join(BE, 'uploads', dir))) {
    if (!preexisting.has(`${dir}/${f}`)) fs.unlinkSync(path.join(BE, 'uploads', dir, f));
  }
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
