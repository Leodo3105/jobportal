import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getCurrentUser, getUnreadNotificationCount } from "@/lib/api";
import type { UserRole } from "@/types/api";

// Khu riêng của từng vai trò
const AREA_BY_ROLE: Partial<Record<UserRole, string>> = {
  jobseeker: "/jobseeker/applications",
  employer: "/employer",
  admin: "/admin",
};

// Server Component: đọc cookie để biết ai đang đăng nhập ngay khi render trên server,
// nên trang hiện đúng nút từ đầu, không bị "nháy" từ Đăng nhập sang tên người dùng.
export async function SiteHeader() {
  const user = await getCurrentUser();
  // Chỉ gọi khi đã đăng nhập; chưa đăng nhập thì không có thông báo
  const unreadCount = user ? await getUnreadNotificationCount() : 0;

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Logo />

        <nav aria-label="Điều hướng chính" className="mr-auto hidden gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/jobs" className="hover:text-foreground">
            Việc làm
          </Link>
          <Link href="/companies" className="hover:text-foreground">
            Công ty
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {user ? (
            <>
              <NotificationBell unreadCount={unreadCount} />
              <UserMenu name={user.name} areaHref={AREA_BY_ROLE[user.role]} />
            </>
          ) : (
            <>
              {/* asChild: Button không tự tạo thẻ <button>, mà "mặc" style lên thẻ Link bên trong */}
              <Button asChild variant="ghost">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Đăng ký</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
