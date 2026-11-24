export type JobType = "full-time" | "part-time" | "contract" | "freelance" | "internship";

export type ExperienceLevel = "entry" | "junior" | "mid-level" | "senior" | "executive";

// Công ty khi được populate trong danh sách job (backend chỉ chọn vài field)
export interface CompanySummary {
  _id: string;
  name: string;
  logo: string; // tên file, xem tại /uploads/logos/<logo>
  location: string;
  industry?: string;
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  category: string; // tên danh mục, ví dụ "Công nghệ thông tin"
  skills: string[];
  experienceLevel: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  showSalary: boolean;
  featured: boolean;
  applicationDeadline: string; // ngày dạng chuỗi ISO
  createdAt: string;
  company: CompanySummary | null; // null nếu công ty đã bị xoá
}

// ===== Chi tiết tin (GET /api/jobs/:id) =====

export type JobStatus = "active" | "closed" | "draft" | "expired";

// ===== Việc đã lưu (GET /api/saved-jobs) =====

// Dữ liệu đủ để vẽ thẻ tin (JobCard). Danh sách đã lưu không có mô tả, ngành, nhưng có trạng thái tin.
export type JobCardData = Omit<Job, "description" | "category"> & { status?: JobStatus };

export interface SavedJobItem {
  _id: string;
  createdAt: string; // lúc lưu
  job: JobCardData | null; // null nếu tin đã bị xoá
}

export interface SavedJobListResponse {
  success: boolean;
  count: number;
  total: number;
  totalPages: number;
  data: SavedJobItem[];
}

export type EducationLevel = "high-school" | "associate" | "bachelor" | "master" | "phd" | "any";

export type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";

// Trang chi tiết populate nhiều field công ty hơn danh sách
export interface CompanyDetail extends CompanySummary {
  description: string;
  website?: string;
  companySize: CompanySize;
}

// Omit<Job, "company">: lấy mọi field của Job trừ company, rồi khai báo lại company kiểu chi tiết
export interface JobDetail extends Omit<Job, "company"> {
  requirements: string;
  benefits: string;
  educationLevel: EducationLevel;
  status: JobStatus;
  views: number;
  company: CompanyDetail | null;
}

// ===== Hồ sơ ứng viên (GET /api/profiles) =====

export interface EducationItem {
  _id: string;
  school: string;
  degree: string;
  fieldOfStudy: string;
  from: string; // ngày dạng ISO, FE chỉ dùng tháng/năm
  to?: string;
  current: boolean;
  description?: string;
}

export interface ExperienceItem {
  _id: string;
  company: string;
  position: string;
  location?: string;
  from: string;
  to?: string;
  current: boolean;
  description?: string;
}

export interface JobseekerProfile {
  _id: string;
  title: string;
  bio?: string;
  location?: string;
  phone?: string;
  dob?: string | null;
  website?: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  cvFile?: string;
  socialMedia?: { linkedin?: string; github?: string; twitter?: string };
  desiredPosition?: string;
  desiredSalary?: number; // VND, 0 = chưa nhập
  workType: JobType;
  availableFrom?: string | null;
  visibility: boolean;
}

// ===== Đơn ứng tuyển =====

export type ApplicationStatus = "pending" | "viewed" | "interview" | "accepted" | "rejected" | "withdrawn";

export interface Interview {
  _id: string;
  date: string;
  location?: string;
  type: "in-person" | "phone" | "video";
  notes?: string; // lời dặn của NTD cho ứng viên, ví dụ "Mang CV bản giấy"
}

// Một phần tử của GET /api/applications/user/myapplications
// (backend đã bỏ field `notes` là ghi chú nội bộ của NTD)
export interface MyApplication {
  _id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  coverLetter?: string;
  attachedCV?: string;
  employerFeedback?: string;
  interviews: Interview[];
  job: {
    _id: string;
    title: string;
    location: string;
    status: JobStatus;
    applicationDeadline: string;
    company: { _id: string; name: string; logo: string } | null;
  } | null; // null nếu tin đã bị xoá
}

// ===== Khu nhà tuyển dụng =====

// Công ty công khai (GET /api/companies/all và /api/companies/:id).
// Backend chỉ trả field công khai và gắn thêm số tin đang tuyển.
export interface PublicCompany {
  _id: string;
  name: string;
  description: string;
  website?: string;
  industry: string;
  companySize: CompanySize;
  location: string;
  logo: string;
  foundedYear?: number | null;
  socialMedia?: { facebook?: string; linkedin?: string; twitter?: string };
  featured: boolean;
  openJobCount: number;
}

export interface CompanyListResponse {
  success: boolean;
  count: number;
  total: number;
  totalPages: number;
  data: PublicCompany[];
}

// Công ty của NTD đang đăng nhập (GET /api/companies)
export interface MyCompany {
  _id: string;
  name: string;
  description: string;
  website?: string;
  industry: string;
  companySize: CompanySize;
  location: string;
  logo: string;
  foundedYear?: number | null;
  socialMedia?: { facebook?: string; linkedin?: string; twitter?: string };
}

// Một phần tử của GET /api/jobs/employer/myjobs (backend trả cả tin, gắn thêm số đơn)
export interface EmployerJob {
  _id: string;
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  location: string;
  category: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  educationLevel: EducationLevel;
  skills: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  showSalary: boolean;
  status: JobStatus;
  applicationDeadline: string;
  views: number;
  createdAt: string;
  applicationCount: number; // không tính đơn đã rút
  pendingCount: number; // đơn NTD chưa mở
}

// Một phần tử của GET /api/applications/job/:jobId
export interface EmployerApplicationItem {
  _id: string;
  status: ApplicationStatus;
  createdAt: string;
  user: { _id: string; name: string; email: string; avatar: string } | null;
  profile: { _id: string; title: string; skills: string[]; location?: string } | null;
}

export interface ApplicationNote {
  _id: string;
  content: string;
  createdAt: string;
}

// GET /api/applications/:id khi NTD xem (có cả ghi chú nội bộ)
export interface EmployerApplicationDetail {
  _id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  coverLetter?: string;
  attachedCV?: string;
  employerFeedback?: string;
  interviews: Interview[];
  notes: ApplicationNote[];
  user: { _id: string; name: string; email: string; avatar: string; phone?: string } | null;
  profile: {
    _id: string;
    title: string;
    bio?: string;
    skills: string[];
    location?: string;
    website?: string;
    socialMedia?: { linkedin?: string; github?: string; twitter?: string };
    experience: ExperienceItem[];
    education: EducationItem[];
  } | null;
  job: { _id: string; title: string; status: JobStatus; applicationDeadline: string } | null;
}

// ===== Khu admin =====

export type SubscriptionPlan = "free" | "basic" | "premium" | "enterprise";

export interface AdminList<T> {
  success: boolean;
  count: number;
  total: number;
  totalPages: number;
  data: T[];
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar: string;
  isActive?: boolean; // tài khoản cũ có thể chưa có field này: coi như đang hoạt động
  createdAt: string;
}

export interface AdminJob {
  _id: string;
  title: string;
  location: string;
  status: JobStatus;
  featured: boolean;
  applicationDeadline: string;
  views: number;
  createdAt: string;
  company: { _id: string; name: string; logo: string } | null;
  user: { _id: string; name: string; email: string } | null;
}

export interface AdminCompany {
  _id: string;
  name: string;
  logo: string;
  industry: string;
  location: string;
  featured: boolean;
  subscription?: { type: SubscriptionPlan; startDate?: string; endDate?: string; status?: string };
  user: { _id: string; name: string; email: string; isActive?: boolean } | null;
  jobCount: number;
  createdAt: string;
}

// GET /api/dashboard/admin
export interface AdminDashboard {
  users: { total: number; jobseekers: number; employers: number; admins: number; locked: number };
  jobs: { total: number; active: number; open: number; closed: number; expired: number; draft: number };
  applications: Record<"total" | ApplicationStatus, number>;
  companies: { total: number; featured: number };
  profiles: { total: number; withCV: number };
  charts: {
    labels: string[]; // "2026-11" theo giờ Việt Nam, 6 tháng gần nhất
    datasets: { newUsers: number[]; newJobs: number[]; newApplications: number[] };
  };
  popular: {
    categories: { _id: string; count: number }[];
    locations: { _id: string; count: number }[];
  };
}

// GET /api/dashboard/employer (404 khi NTD chưa tạo công ty)
export interface EmployerDashboard {
  jobs: { total: number; active: number; open: number; closed: number; expired: number; draft: number };
  applications: Record<"total" | ApplicationStatus, number>;
  charts: {
    labels: string[]; // "2026-11" theo giờ Việt Nam, 6 tháng gần nhất
    datasets: { newJobs: number[]; newApplications: number[] };
  };
  // 5 tin nhiều đơn nhất; số đơn không tính đơn đã rút
  topJobs: {
    _id: string;
    title: string;
    status: JobStatus;
    applicationDeadline: string;
    views: number;
    applicationsCount: number;
    pendingCount: number;
  }[];
}

// GET /api/admin/categories (kể cả danh mục đang ẩn; ngành kèm số lượt dùng)
export interface AdminCategory extends Category {
  icon?: string;
  jobCount?: number;
  companyCount?: number;
}

// ===== Thông báo (GET /api/notifications) =====

export interface AppNotification {
  _id: string;
  type: "application_status" | "new_application" | "interview_invitation" | "job_recommendation" | "message" | "system";
  title: string;
  message: string;
  link?: string; // đường dẫn trong FE, ví dụ /jobseeker/applications/<id>
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  count: number;
  total: number;
  totalPages: number;
  unreadCount: number;
  data: AppNotification[];
}

export interface Category {
  _id: string;
  name: string;
  type: "industry" | "skill" | "position" | "location";
  slug: string;
  description?: string;
  active: boolean;
}

// ===== Đăng nhập, đăng ký =====

export type UserRole = "jobseeker" | "employer" | "admin";

// Thông tin user mà backend trả về sau khi đăng nhập/đăng ký và ở GET /api/auth/me
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string; // tên file trong /uploads/avatars
  avatarUrl: string;
  phone?: string;
}

// Response của POST /api/auth/login và /register.
// Không cần lấy token ở đây: backend đã tự lưu token vào cookie httpOnly.
export interface AuthResponse {
  success: true;
  user: AuthUser;
}

// Hình dạng response của GET /api/jobs
export interface JobListResponse {
  success: boolean;
  count: number;
  totalPages: number;
  pagination: {
    next?: { page: number; limit: number };
    prev?: { page: number; limit: number };
  };
  data: Job[];
}
