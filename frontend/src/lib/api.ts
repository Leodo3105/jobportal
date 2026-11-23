import { cache } from "react";
import { cookies } from "next/headers";

import type {
  AdminCategory,
  AdminCompany,
  AdminDashboard,
  AdminJob,
  AdminList,
  AdminUser,
  AuthUser,
  Category,
  CompanyListResponse,
  EmployerApplicationDetail,
  EmployerApplicationItem,
  EmployerDashboard,
  EmployerJob,
  Job,
  JobDetail,
  JobListResponse,
  JobseekerProfile,
  MyApplication,
  MyCompany,
  NotificationListResponse,
  PublicCompany,
} from "@/types/api";

const API_URL = process.env.API_URL ?? "http://localhost:5000";

// Hàm chung: gọi API, báo lỗi nếu backend trả mã lỗi
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store", // luôn lấy dữ liệu mới, không dùng bản lưu tạm
  });

  if (!res.ok) {
    throw new Error(`Gọi ${path} thất bại, mã ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Các điều kiện lọc mà GET /api/jobs hỗ trợ
export interface JobQuery {
  keyword?: string;
  location?: string;
  category?: string;
  company?: string; // id công ty
  page?: number;
  limit?: number;
}

export async function getJobs(query: JobQuery = {}): Promise<JobListResponse> {
  // URLSearchParams biến object thành chuỗi "keyword=react&page=2"
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return getJson<JobListResponse>(`/api/jobs?${params.toString()}`);
}

// Bọc bằng cache(): generateMetadata và trang cùng gọi getJob(id) trong một lần render
// thì chỉ có 1 request thật tới backend. Không bọc thì mỗi lần mở trang bị tính 2 lượt xem.
export const getJob = cache(async (id: string): Promise<JobDetail | null> => {
  const res = await fetch(`${API_URL}/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });

  // 400: id sai định dạng, 404: không có tin hoặc tin nháp. Cả hai đều là "không tìm thấy".
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Gọi /api/jobs/${id} thất bại, mã ${res.status}`);

  const body = (await res.json()) as { data: JobDetail };
  return body.data;
});

// Việc tương tự không bắt buộc phải có: lỗi thì trả mảng rỗng để trang vẫn hiện bình thường
export async function getSimilarJobs(id: string): Promise<Job[]> {
  try {
    const res = await getJson<{ data: Job[] }>(`/api/jobs/${encodeURIComponent(id)}/similar`);
    return res.data;
  } catch {
    return [];
  }
}

// Các điều kiện lọc mà GET /api/companies/all hỗ trợ
export interface CompanyQuery {
  search?: string;
  industry?: string;
  page?: number;
  limit?: number;
}

export async function getCompanies(query: CompanyQuery = {}): Promise<CompanyListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return getJson<CompanyListResponse>(`/api/companies/all?${params.toString()}`);
}

// cache(): generateMetadata và trang cùng gọi thì chỉ có 1 request.
// 400 (id sai) và 404 (không có) trả null để trang gọi notFound(); lỗi khác thì báo lỗi.
export const getCompany = cache(async (id: string): Promise<PublicCompany | null> => {
  const res = await fetch(`${API_URL}/api/companies/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Gọi /api/companies/${id} thất bại, mã ${res.status}`);
  const body = (await res.json()) as { data: PublicCompany };
  return body.data;
});

export async function getCategories(): Promise<Category[]> {
  const res = await getJson<{ data: Category[] }>("/api/categories/type/industry?active=true");
  return res.data;
}

// Gọi API cần đăng nhập từ Server Component: tự chuyển tiếp cookie token của trình duyệt.
// Trả nguyên body JSON; null khi chưa đăng nhập, backend trả mã lỗi (401, 403, 404...) hoặc backend tắt.
async function getBodyWithCookie<B>(path: string): Promise<B | null> {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null; // không có cookie thì khỏi gọi backend

  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as B;
  } catch {
    return null;
  }
}

// Như trên nhưng chỉ lấy field `data` (dạng trả về phổ biến nhất của backend)
async function getWithCookie<T>(path: string): Promise<T | null> {
  const body = await getBodyWithCookie<{ data: T }>(path);
  return body?.data ?? null;
}

// null: token hết hạn, sai, user đã bị xoá, hoặc backend tắt (coi như chưa đăng nhập để trang vẫn hiện được)
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  return getWithCookie<AuthUser>("/api/auth/me");
});

// Tên file CV trong hồ sơ của ứng viên đang đăng nhập. Chưa có hồ sơ (404) hoặc chưa có CV thì null.
export async function getMyProfileCv(): Promise<string | null> {
  const profile = await getMyProfile();
  return profile?.cvFile || null;
}

// Hồ sơ của ứng viên đang đăng nhập. Chưa tạo hồ sơ (backend trả 404) thì null.
export async function getMyProfile(): Promise<JobseekerProfile | null> {
  return getWithCookie<JobseekerProfile>("/api/profiles");
}

// Đơn của ứng viên đang đăng nhập cho một tin (kể cả đơn đã rút). Chưa nộp thì null.
// Backend chưa có API lấy đơn theo tin, nên tạm lấy cả danh sách rồi tìm.
export async function getMyApplicationForJob(jobId: string): Promise<MyApplication | null> {
  const applications = await getMyApplications();
  return applications?.find((application) => application.job?._id === jobId) ?? null;
}

// Mọi đơn của ứng viên đang đăng nhập, mới nhất trước. null khi không lấy được (backend tắt, hết phiên).
export async function getMyApplications(): Promise<MyApplication[] | null> {
  return getWithCookie<MyApplication[]>("/api/applications/user/myapplications");
}

// Một đơn của ứng viên đang đăng nhập. Id sai (400), đơn của người khác (403), không có (404) đều trả null.
export async function getMyApplication(id: string): Promise<MyApplication | null> {
  return getWithCookie<MyApplication>(`/api/applications/${encodeURIComponent(id)}`);
}

// ===== Khu nhà tuyển dụng =====

// Công ty của NTD đang đăng nhập. Chưa tạo công ty (backend trả 404) thì null.
export async function getMyCompany(): Promise<MyCompany | null> {
  return getWithCookie<MyCompany>("/api/companies");
}

export async function getMyJobs(): Promise<EmployerJob[] | null> {
  return getWithCookie<EmployerJob[]>("/api/jobs/employer/myjobs");
}

// Đơn của một tin. Tin không phải của mình (403) hoặc không có (404) thì null.
export async function getJobApplications(jobId: string): Promise<EmployerApplicationItem[] | null> {
  return getWithCookie<EmployerApplicationItem[]>(`/api/applications/job/${encodeURIComponent(jobId)}`);
}

// Chi tiết đơn cho NTD. Lưu ý: lần đầu NTD mở, backend đổi đơn "pending" thành "viewed" và báo cho ứng viên.
export async function getEmployerApplication(id: string): Promise<EmployerApplicationDetail | null> {
  return getWithCookie<EmployerApplicationDetail>(`/api/applications/${encodeURIComponent(id)}`);
}

// Số liệu tổng quan của NTD. Chưa có công ty (404) hoặc lỗi thì null.
export async function getEmployerDashboard(): Promise<EmployerDashboard | null> {
  return getWithCookie<EmployerDashboard>("/api/dashboard/employer");
}

// ===== Khu admin =====

// Biến object điều kiện lọc thành query string, bỏ giá trị rỗng
function toQuery(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export const ADMIN_PAGE_SIZE = 20;

export async function getAdminUsers(query: { search?: string; role?: string; status?: string; page?: number }) {
  return getBodyWithCookie<AdminList<AdminUser>>(`/api/admin/users?${toQuery({ ...query, limit: ADMIN_PAGE_SIZE })}`);
}

export async function getAdminJobs(query: { search?: string; status?: string; page?: number }) {
  return getBodyWithCookie<AdminList<AdminJob>>(`/api/admin/jobs?${toQuery({ ...query, limit: ADMIN_PAGE_SIZE })}`);
}

export async function getAdminCompanies(query: { search?: string; plan?: string; page?: number }) {
  return getBodyWithCookie<AdminList<AdminCompany>>(`/api/admin/companies?${toQuery({ ...query, limit: ADMIN_PAGE_SIZE })}`);
}

export async function getAdminDashboard(): Promise<AdminDashboard | null> {
  return getWithCookie<AdminDashboard>("/api/dashboard/admin");
}

export async function getAdminCategories(type?: string): Promise<AdminCategory[] | null> {
  return getWithCookie<AdminCategory[]>(`/api/admin/categories?${toQuery({ type })}`);
}

export const NOTIFICATIONS_PER_PAGE = 20;

export async function getNotifications(page = 1): Promise<NotificationListResponse | null> {
  return getBodyWithCookie<NotificationListResponse>(`/api/notifications?page=${page}&limit=${NOTIFICATIONS_PER_PAGE}`);
}

// Số thông báo chưa đọc cho chuông trên header. Lỗi thì coi như 0.
// cache(): header và trang thông báo cùng gọi trong một lần render thì chỉ gọi backend 1 lần.
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const body = await getBodyWithCookie<NotificationListResponse>("/api/notifications?limit=1");
  return body?.unreadCount ?? 0;
});
