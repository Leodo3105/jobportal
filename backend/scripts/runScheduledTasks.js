// Chạy tác vụ định kỳ một lần (tin hết hạn, gói dịch vụ hết hạn) rồi thoát.
// Usage: npm run tasks
// Server đã tự chạy các tác vụ này mỗi giờ; script này dùng để thử tay, cho test e2e,
// hoặc để chạy bằng cron của hệ điều hành nếu không muốn chạy trong server.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runScheduledTasks } from '../src/jobs/scheduledTasks.js';

dotenv.config();

if (!process.env.MONGO_URI) {
  console.error('Thiếu MONGO_URI trong file .env');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await runScheduledTasks();
  if (result.errors.length) process.exitCode = 1;
} catch (error) {
  console.error('Lỗi chạy tác vụ định kỳ:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
