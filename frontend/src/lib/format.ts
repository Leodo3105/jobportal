import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import type { ApplicationStatus, Interview, JobStatus, SubscriptionPlan, UserRole, CompanySize, EducationLevel, ExperienceLevel, Job, JobDetail, JobType } from "@/types/api";

// Đổi giá trị lưu trong database sang chữ hiển thị cho người dùng
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Toàn thời gian",
  "part-time": "Bán thời gian",
  contract: "Hợp đồng",
  freelance: "Freelance",
  internship: "Thực tập",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  entry: "Mới đi làm",
  junior: "Junior",
  "mid-level": "Middle",
  senior: "Senior",
  executive: "Quản lý",
};

// 15000000 => "15"  |  12500000 => "12,5"
function toMillions(value: number): string {
  return (value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

export function formatSalary(job: Pick<Job, "salaryMin" | "salaryMax" | "salaryCurrency" | "showSalary">): string {
  const { salaryMin, salaryMax, salaryCurrency, showSalary } = job;

  if (!showSalary || (!salaryMin && !salaryMax)) {
    return "Thỏa thuận";
  }

  if (salaryCurrency === "VND") {
    if (salaryMin && salaryMax) return `${toMillions(salaryMin)} - ${toMillions(salaryMax)} triệu`;
    if (salaryMin) return `Từ ${toMillions(salaryMin)} triệu`;
    return `Đến ${toMillions(salaryMax!)} triệu`;
  }

  // Tiền tệ khác (USD...): hiển thị số đầy đủ kèm mã tiền tệ
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (salaryMin && salaryMax) return `${fmt(salaryMin)} - ${fmt(salaryMax)} ${salaryCurrency}`;
  if (salaryMin) return `Từ ${fmt(salaryMin)} ${salaryCurrency}`;
  return `Đến ${fmt(salaryMax!)} ${salaryCurrency}`;
}

// "2025-11-16T..." => "2 ngày trước"
export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: vi });
}

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  "high-school": "Trung học phổ thông",
  associate: "Cao đẳng",
  bachelor: "Đại học",
  master: "Thạc sĩ",
  phd: "Tiến sĩ",
  any: "Không yêu cầu",
};

export function companySizeLabel(size: CompanySize): string {
  return `${size} nhân viên`;
}

// "2026-12-30T..." => "30/12/2026"
export function formatDate(date: string): string {
  return format(new Date(date), "dd/MM/yyyy");
}

// Tin còn nhận hồ sơ khi đang active và chưa qua hạn nộp.
// Backend vẫn trả tin closed/expired/quá hạn ở trang chi tiết, FE tự kiểm tra.
export function isJobOpen(job: Pick<JobDetail, "status" | "applicationDeadline">): boolean {
  return job.status === "active" && new Date(job.applicationDeadline) >= new Date();
}

// Số ngày còn lại tới hạn nộp, dạng chữ: "Hôm nay là hạn cuối", "Còn 12 ngày"
export function deadlineHint(deadline: string): string {
  const days = differenceInCalendarDays(new Date(deadline), new Date());
  if (days <= 0) return "Hôm nay là hạn cuối";
  return `Còn ${days} ngày`;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Đang chờ xem",
  viewed: "Nhà tuyển dụng đã xem",
  interview: "Được mời phỏng vấn",
  accepted: "Đã được nhận",
  rejected: "Chưa phù hợp",
  withdrawn: "Đã rút đơn",
};

// Nhãn ngắn phía nhà tuyển dụng (APPLICATION_STATUS_LABELS ở trên viết theo góc nhìn ứng viên)
export const EMPLOYER_APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Chưa xem",
  viewed: "Đã xem",
  interview: "Phỏng vấn",
  accepted: "Đã nhận",
  rejected: "Chưa phù hợp",
  withdrawn: "Đã rút",
};

// Backend đặt tên file CV là "cv-<userId>-<thời điểm tải lên>.pdf", không dễ đọc.
// Lấy thời điểm và đuôi file để hiện "File PDF, tải lên ngày 20/11/2026".
export function describeCvFile(fileName: string): string {
  const match = fileName.match(/-(\d{13})\.(\w+)$/);
  if (!match) return "File đã tải lên";
  const date = formatDate(new Date(Number(match[1])).toISOString());
  return `File ${match[2].toUpperCase()}, tải lên ngày ${date}`;
}

// Đơn ở các trạng thái này mới rút được (khớp WITHDRAWABLE_STATUSES ở backend applicationController.js)
export const WITHDRAWABLE_STATUSES: ApplicationStatus[] = ["pending", "viewed", "interview"];

export const INTERVIEW_TYPE_LABELS: Record<Interview["type"], string> = {
  "in-person": "Phỏng vấn trực tiếp",
  phone: "Phỏng vấn qua điện thoại",
  video: "Phỏng vấn online",
};

// Luôn hiện theo giờ Việt Nam. Không đặt timeZone thì Server Component dùng múi giờ của máy chủ
// (thường là UTC khi deploy), và lịch phỏng vấn 16:00 sẽ hiện thành 09:00.
const VN_DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// "2030-01-10T09:00:00Z" => "16:00 10/01/2030"
export function formatDateTime(date: string): string {
  return VN_DATE_TIME.format(new Date(date));
}

// Màu nhãn trạng thái: primary cho tin vui (mời phỏng vấn, được nhận),
// secondary cho đang chờ, outline cho đơn đã kết thúc (từ chối, đã rút).
export const APPLICATION_STATUS_VARIANT: Record<ApplicationStatus, "default" | "secondary" | "outline"> = {
  pending: "secondary",
  viewed: "secondary",
  interview: "default",
  accepted: "default",
  rejected: "outline",
  withdrawn: "outline",
};

// "2018-09-01T00:00:00.000Z" => "09/2018". Học vấn/kinh nghiệm chỉ quan tâm tháng và năm.
function monthYear(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

// Khoảng thời gian của một mục học vấn/kinh nghiệm: "09/2018 – 06/2022" hoặc "09/2018 – nay"
export function formatPeriod(item: { from: string; to?: string; current: boolean }): string {
  return `${monthYear(item.from)} – ${item.current || !item.to ? "nay" : monthYear(item.to)}`;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Đang tuyển",
  draft: "Bản nháp",
  closed: "Đã đóng",
  expired: "Hết hạn",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  jobseeker: "Ứng viên",
  employer: "Nhà tuyển dụng",
  admin: "Quản trị viên",
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Miễn phí",
  basic: "Cơ bản",
  premium: "Premium",
  enterprise: "Doanh nghiệp",
};

// "2026-11" => "T11/2026" (nhãn tháng ngắn cho biểu đồ), "Tháng 11/2026" khi long = true
export function formatMonthKey(key: string, long = false): string {
  const [year, month] = key.split("-");
  return long ? `Tháng ${Number(month)}/${year}` : `T${Number(month)}/${year.slice(2)}`;
}

export const CATEGORY_TYPE_LABELS = {
  industry: "Ngành nghề",
  skill: "Kỹ năng",
  position: "Vị trí",
  location: "Địa điểm",
} as const;
