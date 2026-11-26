// Seed demo data: categories, employers + companies, jobs, one jobseeker.
// Usage: npm run seed
// Safe to run many times: it only removes data it created before
// (users whose email ends with @demo.vn, their companies, jobs, profiles,
// applications, notifications and CV files, and the categories listed below). Your own data is left untouched.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Company from '../src/models/employer/Company.js';
import Job from '../src/models/job/Job.js';
import Category from '../src/models/category/Category.js';
import JobseekerProfile from '../src/models/jobseeker/Profile.js';
import Application from '../src/models/job/Application.js';
import Notification from '../src/models/notification/Notification.js';
import { CV_DIR, removeUploadFile } from '../src/config/paths.js';

dotenv.config();

const DEMO_DOMAIN = '@demo.vn';
const DEMO_PASSWORD = 'Demo@1234';
// Gói được hiện nổi bật (giống FEATURED_PLANS trong controllers/admin/adminController.js)
const FEATURED_PLANS = ['premium', 'enterprise'];

if (!process.env.MONGO_URI) {
  console.error('Thiếu MONGO_URI trong file .env');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Không chạy seed trên môi trường production.');
  process.exit(1);
}

// ---------- Dữ liệu mẫu ----------

const CATEGORIES = [
  { name: 'Công nghệ thông tin', slug: 'cong-nghe-thong-tin' },
  { name: 'Marketing', slug: 'marketing' },
  { name: 'Kế toán - Tài chính', slug: 'ke-toan-tai-chinh' },
  { name: 'Thiết kế', slug: 'thiet-ke' },
  { name: 'Nhân sự', slug: 'nhan-su' },
  { name: 'Kinh doanh - Bán hàng', slug: 'kinh-doanh-ban-hang' }
];

const COMPANIES = [
  {
    email: `hr.techviet${DEMO_DOMAIN}`,
    contact: 'Nguyễn Thu Hà',
    name: 'Công ty TNHH TechViet Solutions',
    description: 'Công ty phát triển phần mềm outsource và sản phẩm SaaS cho thị trường Nhật Bản và Singapore.',
    website: 'https://techviet.example.com',
    industry: 'Công nghệ thông tin',
    companySize: '201-500',
    location: 'Hà Nội',
    foundedYear: 2015,
    plan: 'premium'
  },
  {
    email: `tuyendung.saigonsoft${DEMO_DOMAIN}`,
    contact: 'Trần Minh Quân',
    name: 'SaigonSoft JSC',
    description: 'Startup fintech cung cấp giải pháp thanh toán cho hơn 10.000 cửa hàng bán lẻ.',
    website: 'https://saigonsoft.example.com',
    industry: 'Công nghệ thông tin',
    companySize: '51-200',
    location: 'Hồ Chí Minh',
    foundedYear: 2019
  },
  {
    email: `hr.greenmart${DEMO_DOMAIN}`,
    contact: 'Lê Phương Anh',
    name: 'Chuỗi siêu thị GreenMart',
    description: 'Chuỗi siêu thị thực phẩm sạch với hơn 80 cửa hàng trên toàn quốc.',
    website: 'https://greenmart.example.com',
    industry: 'Kinh doanh - Bán hàng',
    companySize: '1000+',
    location: 'Đà Nẵng',
    foundedYear: 2010,
    plan: 'premium'
  }
];

// company = vị trí trong mảng COMPANIES ở trên.
// Không đặt featured ở đây: tin nổi bật theo gói của công ty (plan premium/enterprise), giống khi admin đổi gói.
const JOBS = [
  { company: 0, title: 'Backend Developer (Node.js)', category: 'Công nghệ thông tin', location: 'Hà Nội', jobType: 'full-time', experienceLevel: 'junior', skills: ['Node.js', 'Express', 'MongoDB', 'REST API'], salaryMin: 15000000, salaryMax: 25000000 },
  { company: 0, title: 'Frontend Developer (React/Next.js)', category: 'Công nghệ thông tin', location: 'Hà Nội', jobType: 'full-time', experienceLevel: 'mid-level', skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'], salaryMin: 20000000, salaryMax: 35000000 },
  { company: 0, title: 'Thực tập sinh Backend', category: 'Công nghệ thông tin', location: 'Hà Nội', jobType: 'internship', experienceLevel: 'entry', skills: ['JavaScript', 'SQL', 'Git'], salaryMin: 3000000, salaryMax: 5000000 },
  { company: 0, title: 'Tester / QA Engineer', category: 'Công nghệ thông tin', location: 'Hà Nội', jobType: 'full-time', experienceLevel: 'junior', skills: ['Manual Test', 'Postman', 'Selenium'], salaryMin: 12000000, salaryMax: 18000000 },
  { company: 0, title: 'UI/UX Designer', category: 'Thiết kế', location: 'Hà Nội', jobType: 'full-time', experienceLevel: 'mid-level', skills: ['Figma', 'Design System', 'User Research'], salaryMin: 18000000, salaryMax: 28000000 },
  { company: 1, title: 'Fullstack Developer (Node.js + React)', category: 'Công nghệ thông tin', location: 'Hồ Chí Minh', jobType: 'full-time', experienceLevel: 'mid-level', skills: ['Node.js', 'React', 'PostgreSQL', 'Docker'], salaryMin: 25000000, salaryMax: 40000000 },
  { company: 1, title: 'Senior Java Developer', category: 'Công nghệ thông tin', location: 'Hồ Chí Minh', jobType: 'full-time', experienceLevel: 'senior', skills: ['Java', 'Spring Boot', 'Microservices', 'Kafka'], salaryMin: 40000000, salaryMax: 60000000 },
  { company: 1, title: 'DevOps Engineer', category: 'Công nghệ thông tin', location: 'Hồ Chí Minh', jobType: 'full-time', experienceLevel: 'mid-level', skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'], salaryMin: 30000000, salaryMax: 45000000 },
  { company: 1, title: 'Kế toán tổng hợp', category: 'Kế toán - Tài chính', location: 'Hồ Chí Minh', jobType: 'full-time', experienceLevel: 'junior', skills: ['MISA', 'Excel', 'Thuế'], salaryMin: 10000000, salaryMax: 15000000 },
  { company: 1, title: 'Digital Marketing Executive', category: 'Marketing', location: 'Hồ Chí Minh', jobType: 'full-time', experienceLevel: 'junior', skills: ['Facebook Ads', 'Google Ads', 'SEO'], salaryMin: 12000000, salaryMax: 20000000 },
  { company: 1, title: 'Freelance Content Writer', category: 'Marketing', location: 'Remote', jobType: 'freelance', experienceLevel: 'entry', skills: ['Copywriting', 'SEO'], salaryMin: 5000000, salaryMax: 10000000 },
  { company: 2, title: 'Nhân viên bán hàng', category: 'Kinh doanh - Bán hàng', location: 'Đà Nẵng', jobType: 'part-time', experienceLevel: 'entry', skills: ['Giao tiếp', 'Chăm sóc khách hàng'], salaryMin: 5000000, salaryMax: 7000000 },
  { company: 2, title: 'Cửa hàng trưởng', category: 'Kinh doanh - Bán hàng', location: 'Đà Nẵng', jobType: 'full-time', experienceLevel: 'mid-level', skills: ['Quản lý', 'Bán lẻ'], salaryMin: 15000000, salaryMax: 20000000 },
  { company: 2, title: 'Chuyên viên tuyển dụng', category: 'Nhân sự', location: 'Đà Nẵng', jobType: 'full-time', experienceLevel: 'junior', skills: ['Tuyển dụng', 'Phỏng vấn'], salaryMin: 10000000, salaryMax: 14000000 },
  { company: 2, title: 'Graphic Designer', category: 'Thiết kế', location: 'Đà Nẵng', jobType: 'contract', experienceLevel: 'junior', skills: ['Photoshop', 'Illustrator'], salaryMin: 9000000, salaryMax: 13000000 },
  { company: 2, title: 'Kế toán kho', category: 'Kế toán - Tài chính', location: 'Đà Nẵng', jobType: 'full-time', experienceLevel: 'entry', skills: ['Excel', 'Quản lý kho'], salaryMin: 8000000, salaryMax: 11000000 }
];

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// ---------- Chạy seed ----------

try {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Xoá dữ liệu demo cũ (chỉ của seed)
  const oldUsers = await User.find({ email: { $regex: `${DEMO_DOMAIN.replace('.', '\\.')}$` } }).select('_id');
  const oldIds = oldUsers.map((u) => u._id);
  const oldJobIds = (await Job.find({ user: { $in: oldIds } }).select('_id')).map((j) => j._id);

  // Đơn của ứng viên demo, hoặc đơn nộp vào tin demo (kể cả do tài khoản thật nộp)
  const oldApps = await Application.find({
    $or: [{ user: { $in: oldIds } }, { job: { $in: oldJobIds } }]
  }).select('attachedCV');
  const oldProfiles = await JobseekerProfile.find({ user: { $in: oldIds } }).select('cvFile');
  const oldCVs = new Set([...oldApps.map((a) => a.attachedCV), ...oldProfiles.map((p) => p.cvFile)].filter(Boolean));

  await Application.deleteMany({ _id: { $in: oldApps.map((a) => a._id) } });
  await JobseekerProfile.deleteMany({ user: { $in: oldIds } });
  await Notification.deleteMany({ user: { $in: oldIds } });

  // Chỉ xoá file CV không còn ai dùng (một tài khoản thật có thể nộp cùng file vào tin khác)
  for (const file of oldCVs) {
    const stillUsed = (await Application.exists({ attachedCV: file })) || (await JobseekerProfile.exists({ cvFile: file }));
    if (!stillUsed) removeUploadFile(CV_DIR, file);
  }

  await Job.deleteMany({ user: { $in: oldIds } });
  await Company.deleteMany({ user: { $in: oldIds } });
  await User.deleteMany({ _id: { $in: oldIds } });
  await Category.deleteMany({ name: { $in: CATEGORIES.map((c) => c.name) } });

  // 2. Danh mục ngành nghề
  await Category.insertMany(CATEGORIES.map((c) => ({ ...c, type: 'industry', active: true })));

  // 3. Nhà tuyển dụng + công ty
  // Dùng User.create (không dùng insertMany) để hook pre('save') hash mật khẩu.
  const companies = [];
  for (const c of COMPANIES) {
    const employer = await User.create({
      name: c.contact,
      email: c.email,
      password: DEMO_PASSWORD,
      role: 'employer'
    });
    const { email, contact, plan = 'free', ...companyData } = c;
    // Giống setCompanySubscription của admin: gói premium/enterprise thì công ty (và tin, ở bước 4) nổi bật.
    // Gói free không đặt endDate riêng (model tự đặt +1 tháng, gói free không bao giờ hết hạn).
    const featured = FEATURED_PLANS.includes(plan);
    const subscription = plan === 'free'
      ? { type: 'free', status: 'active' }
      : { type: plan, startDate: new Date(), endDate: daysFromNow(365), status: 'active' };
    companies.push(await Company.create({ ...companyData, subscription, featured, user: employer._id }));
  }

  // 4. Tin tuyển dụng
  const jobs = JOBS.map((j, i) => {
    const company = companies[j.company];
    return {
      ...j,
      company: company._id,
      user: company.user,
      featured: company.featured,
      description: `${company.name} đang tìm kiếm ${j.title} tham gia đội ngũ tại ${j.location}. Bạn sẽ làm việc cùng các đồng nghiệp giàu kinh nghiệm trong môi trường năng động.`,
      requirements: `- Có kiến thức về: ${j.skills.join(', ')}\n- Chủ động, có tinh thần trách nhiệm\n- Kỹ năng giao tiếp và làm việc nhóm tốt`,
      benefits: '- Lương tháng 13, thưởng theo hiệu quả công việc\n- Bảo hiểm đầy đủ theo luật lao động\n- 12 ngày phép năm, du lịch công ty hằng năm',
      showSalary: i % 4 !== 3, // vài tin để "Thoả thuận"
      status: 'active',
      applicationDeadline: daysFromNow(14 + i * 3)
    };
  });
  await Job.insertMany(jobs);

  // 5. Một ứng viên để thử đăng nhập
  await User.create({
    name: 'Phạm Văn An',
    email: `ungvien${DEMO_DOMAIN}`,
    password: DEMO_PASSWORD,
    role: 'jobseeker'
  });

  console.log(`Đã tạo ${CATEGORIES.length} danh mục, ${COMPANIES.length} công ty, ${JOBS.length} tin tuyển dụng.`);
  console.log(`Tài khoản demo (mật khẩu chung: ${DEMO_PASSWORD}):`);
  COMPANIES.forEach((c) => console.log(`  NTD:      ${c.email}`));
  console.log(`  Ứng viên: ungvien${DEMO_DOMAIN}`);
} catch (error) {
  console.error('Lỗi seed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
