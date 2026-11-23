import { safeNext } from "@/lib/auth-redirect";

// Backend lưu sẵn đường dẫn FE trong thông báo (field `link`), nhưng một số trang chưa làm:
// /messages/<id> (tin nhắn).
// Chỉ biến thông báo thành link khi trang đích đã có, tránh đưa người dùng tới trang 404.
// LÀM XONG TRANG NÀO THÌ THÊM TIỀN TỐ VÀO ĐÂY.
const AVAILABLE_PREFIXES = ["/jobseeker/", "/employer/", "/jobs/"];

export function notificationHref(link?: string): string | null {
  // safeNext: chỉ nhận đường dẫn nội bộ bắt đầu bằng "/" (chặn "//evil.com", "https://...")
  const path = safeNext(link);
  if (!path) return null;
  return AVAILABLE_PREFIXES.some((prefix) => path.startsWith(prefix)) ? path : null;
}
