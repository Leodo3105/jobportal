// Tác vụ định kỳ (src/jobs/scheduledTasks.js): tin quá hạn → expired, gói trả phí hết hạn → free,
// thông báo cho NTD, chạy lại không trùng; gia hạn tin expired thì tự mở lại.
// Server khi test không chạy cron (NODE_ENV=test), nên bộ này tự gọi `npm run tasks` (scripts/runScheduledTasks.js).
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import path from 'path';

const [BE, BASE, MONGO] = process.argv.slice(2);
const require = createRequire(path.join(BE, 'package.json'));
const mongoose = require('mongoose');

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const api = async (method, url, { token, json } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(BASE + url, { method, headers, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};
const runTasks = () =>
  execFileSync('node', ['scripts/runScheduledTasks.js'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO }, encoding: 'utf8' });

await mongoose.connect(MONGO);
const db = mongoose.connection.db;
const oid = (id) => new mongoose.Types.ObjectId(id);
const jobDoc = (id) => db.collection('jobs').findOne({ _id: oid(id) });
const companyDoc = (id) => db.collection('companies').findOne({ _id: oid(id) });
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
// Hạn nộp mới: 30 ngày nữa, dạng YYYY-MM-DD như form FE gửi
const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const P = 'Passw0rd!';
const register = async (name, role) =>
  (await api('POST', '/api/auth/register', { json: { name, email: `${name}@t.io`, password: P, role } })).data.token;

// ---------- Chuẩn bị ----------
const E = await register('emp', 'employer');
const E2 = await register('emp2', 'employer');
execFileSync('node', ['scripts/createAdmin.js', 'admin@t.io', P, 'Admin'], { cwd: BE, env: { ...process.env, MONGO_URI: MONGO } });
const A = (await api('POST', '/api/auth/login', { json: { email: 'admin@t.io', password: P } })).data.token;

await api('POST', '/api/companies', { token: E, json: { name: 'ACME', description: 'Công ty phần mềm', industry: 'IT', location: 'HN' } });
await api('POST', '/api/companies', { token: E2, json: { name: 'Free Corp', description: 'Gói miễn phí', industry: 'IT', location: 'HCM' } });
const companyId = (await api('GET', '/api/companies', { token: E })).data.data._id;
const company2Id = (await api('GET', '/api/companies', { token: E2 })).data.data._id;

const jobBody = { title: 'Dev', description: 'd', requirements: 'r', benefits: 'b', location: 'HN', jobType: 'full-time', category: 'IT', applicationDeadline: '2030-01-01' };
const createJob = async (title) => (await api('POST', '/api/jobs', { token: E, json: { ...jobBody, title } })).data.data._id;
const jobA = await createJob('A active quá hạn');
const jobB = await createJob('B closed quá hạn');
const jobC = await createJob('C draft quá hạn');
const jobD = await createJob('D còn hạn');
const jobF = await createJob('F active quá hạn, sửa không gia hạn');
await api('PUT', `/api/jobs/${jobB}/status`, { token: E, json: { status: 'closed' } });
await api('PUT', `/api/jobs/${jobC}/status`, { token: E, json: { status: 'draft' } });
// API không cho đặt hạn ở quá khứ, nên sửa thẳng trong DB
await db.collection('jobs').updateMany({ _id: { $in: [jobA, jobB, jobC, jobF].map(oid) } }, { $set: { applicationDeadline: yesterday } });

const premium = await api('PUT', `/api/admin/companies/${companyId}/subscription`, { token: A, json: { type: 'premium', endDate: '2030-01-01' } });
check('Chuẩn bị: công ty 1 có gói premium, tin nổi bật', premium.status === 200 && (await jobDoc(jobD)).featured === true, `status ${premium.status}`);
// Gói premium đã hết hạn hôm qua; gói free của công ty 2 cũng có endDate ở quá khứ (không được đụng tới)
await db.collection('companies').updateOne({ _id: oid(companyId) }, { $set: { 'subscription.endDate': yesterday } });
await db.collection('companies').updateOne({ _id: oid(company2Id) }, { $set: { 'subscription.endDate': yesterday, featured: true } });

// ---------- Lần chạy thứ nhất ----------
const out1 = runTasks();
check('npm run tasks in kết quả', out1.includes('2 tin hết hạn, 1 gói hết hạn'), out1.trim());

const [a, b, c, d] = await Promise.all([jobA, jobB, jobC, jobD].map(jobDoc));
check('Tin active quá hạn chuyển sang expired', a.status === 'expired', a.status);
check('Tin closed/draft quá hạn giữ nguyên', b.status === 'closed' && c.status === 'draft', `${b.status}, ${c.status}`);
check('Tin còn hạn giữ active', d.status === 'active', d.status);

const c1 = await companyDoc(companyId);
check('Gói premium hết hạn về free, công ty bỏ nổi bật', c1.subscription.type === 'free' && c1.subscription.status === 'active' && c1.featured === false,
  JSON.stringify({ plan: c1.subscription.type, featured: c1.featured }));
const c1Jobs = await db.collection('jobs').find({ company: oid(companyId) }).toArray();
check('Mọi tin của công ty bỏ nổi bật', c1Jobs.every((j) => j.featured === false), c1Jobs.map((j) => j.featured).join(','));
const c2 = await companyDoc(company2Id);
check('Công ty gói free (endDate quá khứ) không bị đụng tới', c2.subscription.type === 'free' && c2.featured === true);

const notes = (await api('GET', '/api/notifications', { token: E })).data.data ?? [];
const jobNotes = notes.filter((n) => n.relatedTo?.model === 'Job');
const planNotes = notes.filter((n) => n.relatedTo?.model === 'Company');
check('NTD nhận thông báo cho 2 tin hết hạn, link tới trang sửa tin',
  jobNotes.length === 2 && jobNotes.every((n) => n.type === 'system' && /^\/employer\/jobs\/[a-f0-9]{24}\/edit$/.test(n.link)),
  `${jobNotes.length} thông báo`);
check('NTD nhận thông báo hết gói, link tới trang công ty',
  planNotes.length === 1 && planNotes[0].link === '/employer/company' && planNotes[0].message.includes('Premium'), `${planNotes.length} thông báo`);
const notes2 = (await api('GET', '/api/notifications', { token: E2 })).data.data ?? [];
check('NTD gói free không nhận thông báo nào', notes2.length === 0, `${notes2.length}`);

// ---------- Chạy lại: không đổi gì, không thông báo trùng ----------
const out2 = runTasks();
const notesAgain = (await api('GET', '/api/notifications', { token: E })).data;
check('Chạy lần hai: 0 tin, 0 gói', out2.includes('0 tin hết hạn, 0 gói hết hạn'), out2.trim());
check('Chạy lần hai: không thêm thông báo', notesAgain.total === notes.length, `${notesAgain.total} so với ${notes.length}`);

// ---------- Gia hạn tin expired ----------
const listBefore = (await api('GET', '/api/jobs?limit=50')).data.data ?? [];
check('Tin expired không hiện ở danh sách công khai', !listBefore.some((j) => j._id === jobA));

const sneaky = await api('PUT', `/api/jobs/${jobF}`, { token: E, json: { title: 'F sửa chính tả', status: 'active' } });
check('Sửa tin expired (không đổi hạn, gửi kèm status) vẫn expired',
  sneaky.status === 200 && (await jobDoc(jobF)).status === 'expired', `${sneaky.status} ${(await jobDoc(jobF)).status}`);
const sameDeadline = await api('PUT', `/api/jobs/${jobF}`, { token: E, json: { applicationDeadline: (await jobDoc(jobF)).applicationDeadline.toISOString() } });
check('Gửi lại đúng hạn cũ (đã qua) thì vẫn expired', sameDeadline.status === 200 && (await jobDoc(jobF)).status === 'expired', `${sameDeadline.status}`);

const extend = await api('PUT', `/api/jobs/${jobA}`, { token: E, json: { applicationDeadline: in30Days } });
check('Gia hạn tin expired: tự mở lại', extend.status === 200 && extend.data.data?.status === 'active' && extend.data.message === 'Đã gia hạn và mở lại tin tuyển dụng',
  `${extend.status} ${extend.data.data?.status ?? extend.data.error}`);
const listAfter = (await api('GET', '/api/jobs?limit=50')).data.data ?? [];
check('Tin đã gia hạn hiện lại ở danh sách công khai', listAfter.some((j) => j._id === jobA));

const extendD = await api('PUT', `/api/jobs/${jobD}`, { token: E, json: { applicationDeadline: in30Days } });
check('Sửa hạn tin active: message bình thường', extendD.status === 200 && extendD.data.message === 'Tin tuyển dụng đã được cập nhật', extendD.data.message);
const otherEmp = await api('PUT', `/api/jobs/${jobF}`, { token: E2, json: { applicationDeadline: in30Days } });
check('NTD khác không gia hạn được tin', otherEmp.status === 403 && (await jobDoc(jobF)).status === 'expired', `status ${otherEmp.status}`);

await mongoose.connection.dropDatabase();
await mongoose.disconnect();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
