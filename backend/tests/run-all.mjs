// Run every e2e suite against a fresh server + throwaway database.
//
// Usage (from the backend folder):
//   npm run test:e2e                 # all suites
//   npm run test:e2e -- smoke        # only suites whose name contains "smoke"
//
// Requirements: MongoDB running locally (or set TEST_MONGO_BASE, e.g.
// mongodb://127.0.0.1:27017). Each suite gets its own database
// (jobportal_e2e_<suite>), dropped before the suite starts (so a crashed
// earlier run cannot leave data behind) and again by the suite when it finishes.
// The server is started with test-only env vars, so your .env is not used
// for these values (dotenv never overrides variables that are already set).
import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(TESTS_DIR, '..');
const LOG_DIR = path.join(TESTS_DIR, '.logs');
const mongoose = createRequire(path.join(BACKEND_DIR, 'package.json'))('mongoose');
const MONGO_BASE = (process.env.TEST_MONGO_BASE || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');

const SUITES = [
  { name: 'smoke', file: 'smoke.mjs', title: 'Smoke test toàn bộ API' },
  { name: 'runtime-bugs', file: 'runtime-bugs.mjs', title: 'Bug runtime (Bước 2)' },
  { name: 'security', file: 'security.mjs', title: 'Bảo mật (Bước 3)' },
  { name: 'password-withdraw-stats', file: 'password-withdraw-stats.mjs', title: 'Quên MK, rút đơn, thống kê (Bước 4)' },
  { name: 'cookie-auth', file: 'cookie-auth.mjs', title: 'Đăng nhập bằng cookie (Giai đoạn 0)' },
  { name: 'admin', file: 'admin.mjs', title: 'Khu admin và chống NoSQL injection ở đăng nhập' }
];

const filter = process.argv[2];
const selected = SUITES.filter((s) => !filter || s.name.includes(filter));
if (!selected.length) {
  console.error(`Không có suite nào khớp "${filter}". Có: ${SUITES.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(LOG_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForServer = async (url, server, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`server exited with code ${server.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error('server did not start in time');
};

const run = (cmd, args, opts) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => resolve(code ?? 1));
  });

const summary = [];
let port = 5600;

for (const suite of selected) {
  port += 1;
  const mongoUri = `${MONGO_BASE}/jobportal_e2e_${suite.name.replace(/-/g, '_')}`;
  // Xoá database tạm trước khi chạy: lần chạy trước bị lỗi giữa chừng (process.exit)
  // thì chưa kịp dọn, dữ liệu cũ (ví dụ email đã đăng ký) sẽ làm bộ test này hỏng theo.
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  await conn.dropDatabase();
  await conn.close();

  const logFile = path.join(LOG_DIR, `${suite.name}.log`);
  const log = fs.openSync(logFile, 'w');

  console.log(`\n━━━ ${suite.title} (${suite.file}) ━━━`);

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      PORT: String(port),
      MONGO_URI: mongoUri,
      NODE_ENV: 'test',
      JWT_SECRET: 'e2e-test-secret',
      JWT_EXPIRE: '1h',
      JWT_COOKIE_DAYS: '',
      CLIENT_URL: 'http://localhost:3000',
      TRUST_PROXY: '',
      SMTP_HOST: '' // reset links are printed to the log, which the tests read
    }
  });

  let code;
  try {
    await waitForServer(`http://localhost:${port}/`, server);
    code = await run(process.execPath, [path.join(TESTS_DIR, 'e2e', suite.file), BACKEND_DIR, `http://localhost:${port}`, mongoUri, logFile], {
      cwd: BACKEND_DIR
    });
  } catch (err) {
    console.error(`Không chạy được suite: ${err.message}. Xem log: ${logFile}`);
    code = 1;
  } finally {
    server.kill();
    fs.closeSync(log);
  }

  summary.push({ suite: suite.title, ok: code === 0 });
}

console.log('\n━━━ Tổng kết ━━━');
for (const s of summary) console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.suite}`);
const failed = summary.filter((s) => !s.ok).length;
console.log(failed ? `\n${failed} suite lỗi. Log server ở tests/.logs/` : '\nTất cả suite đều pass.');
process.exit(failed ? 1 : 0);
