// Tác vụ định kỳ: dọn dữ liệu đã quá hạn theo thời gian.
// Được gọi bởi scheduler.js (mỗi giờ, trong server) và scripts/runScheduledTasks.js (chạy tay).
// Mọi hàm đều chạy lại được nhiều lần (idempotent): lần sau không đổi gì thêm, không gửi thông báo trùng.
import Job from '../models/job/Job.js';
import Company from '../models/employer/Company.js';
import Notification from '../models/notification/Notification.js';

const PAID_PLANS = ['basic', 'premium', 'enterprise'];
const PLAN_LABELS = { basic: 'Cơ bản', premium: 'Premium', enterprise: 'Doanh nghiệp' };

// Tin "active" đã qua hạn nộp → "expired", báo cho NTD để gia hạn.
export const expireJobs = async (now = new Date()) => {
  const jobs = await Job.find({ status: 'active', applicationDeadline: { $lt: now } }).select('_id title user');
  if (!jobs.length) return { expiredJobs: 0 };

  // Lặp lại điều kiện status: 'active': NTD có thể vừa đổi trạng thái tin giữa lúc find và lúc update
  const ids = jobs.map((job) => job._id);
  await Job.updateMany({ _id: { $in: ids }, status: 'active' }, { status: 'expired' });

  // Chỉ báo cho những tin thật sự vừa chuyển sang expired
  const expired = await Job.find({ _id: { $in: ids }, status: 'expired' }).select('_id title user');
  if (expired.length) {
    await Notification.insertMany(
      expired.map((job) => ({
        user: job.user,
        type: 'system',
        title: 'Tin tuyển dụng đã hết hạn',
        message: `Tin "${job.title}" đã hết hạn nộp hồ sơ và không còn hiện với ứng viên. Gia hạn để tiếp tục nhận hồ sơ.`,
        relatedTo: { model: 'Job', id: job._id },
        link: `/employer/jobs/${job._id}/edit`
      }))
    );
  }
  return { expiredJobs: expired.length };
};

// Gói trả phí đã qua endDate → về gói free, bỏ "nổi bật" của công ty và mọi tin của công ty.
// Gói free có endDate mặc định (+1 tháng) nhưng không bao giờ hết hạn, nên chỉ lọc gói trả phí.
export const expireSubscriptions = async (now = new Date()) => {
  const companies = await Company.find({
    'subscription.type': { $in: PAID_PLANS },
    'subscription.endDate': { $lt: now }
  });

  for (const company of companies) {
    const oldPlan = company.subscription.type;
    company.subscription = { type: 'free', startDate: now, status: 'active' };
    company.featured = false;
    await company.save();
    // Tin của công ty đi theo gói (giống setCompanySubscription của admin)
    await Job.updateMany({ company: company._id }, { featured: false });

    await Notification.create({
      user: company.user,
      type: 'system',
      title: 'Gói dịch vụ đã hết hạn',
      message: `Gói ${PLAN_LABELS[oldPlan]} của ${company.name} đã hết hạn. Công ty đã chuyển về gói Miễn phí, các tin không còn được đánh dấu nổi bật.`,
      relatedTo: { model: 'Company', id: company._id },
      link: '/employer/company'
    });
  }
  return { expiredSubscriptions: companies.length };
};

// Chạy mọi tác vụ. Mỗi tác vụ bọc try/catch riêng: tác vụ này lỗi thì tác vụ kia vẫn chạy.
export const runScheduledTasks = async (now = new Date()) => {
  const result = { expiredJobs: 0, expiredSubscriptions: 0, errors: [] };
  const tasks = [
    ['expireJobs', expireJobs],
    ['expireSubscriptions', expireSubscriptions]
  ];

  for (const [name, task] of tasks) {
    try {
      Object.assign(result, await task(now));
    } catch (error) {
      console.error(`[scheduled-tasks] ${name} lỗi:`, error?.stack || error);
      result.errors.push(name);
    }
  }

  console.log(
    `[scheduled-tasks] ${now.toISOString()}: ${result.expiredJobs} tin hết hạn, ${result.expiredSubscriptions} gói hết hạn`
  );
  return result;
};
