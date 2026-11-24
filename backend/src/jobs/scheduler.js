// Lên lịch chạy tác vụ định kỳ bên trong server.
// Cú pháp cron: phút giờ ngày tháng thứ. '0 * * * *' = phút 0 của mỗi giờ.
import cron from 'node-cron';
import { runScheduledTasks } from './scheduledTasks.js';

export const startScheduler = () => {
  // Chạy ngay 1 lần khi server khởi động: server tắt lâu thì không phải đợi tới giờ tiếp theo
  runScheduledTasks();
  cron.schedule('0 * * * *', () => runScheduledTasks());
  console.log('[scheduled-tasks] Đã lên lịch chạy mỗi giờ');
};
