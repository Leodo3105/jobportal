import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api";
import { homeForRole } from "@/lib/auth-redirect";
import type { AuthUser, UserRole } from "@/types/api";

// Dùng trong layout của khu riêng (/jobseeker, /employer...). Middleware đã chặn khi thiếu cookie;
// hàm này kiểm tra kỹ hơn: token còn hợp lệ không, và có đúng vai trò không.
// Trả về user nếu hợp lệ, không thì redirect (redirect() dừng render, không chạy tiếp).
export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    // Có cookie nhưng token hết hạn/sai (hoặc backend tắt). Header "x-pathname" do middleware.ts gắn.
    const pathname = (await headers()).get("x-pathname") ?? `/${role}`;
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (user.role !== role) redirect(homeForRole(user.role));

  return user;
}
