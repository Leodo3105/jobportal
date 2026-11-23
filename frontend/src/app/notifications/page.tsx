import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ErrorNotice } from "@/components/error-notice";
import { Pagination } from "@/components/jobs/pagination";
import { MarkAllReadButton, NotificationList } from "@/components/notifications/notification-list";
import { getCurrentUser, getNotifications } from "@/lib/api";

export const metadata: Metadata = {
  title: "Thông báo",
  robots: { index: false },
};

interface NotificationsPageProps {
  searchParams: Promise<{ page?: string }>;
}

// Trang dùng chung cho mọi vai trò. Middleware đã chặn khi thiếu cookie;
// ở đây kiểm tra token còn hợp lệ.
export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/notifications")}`);

  const result = await getNotifications(page);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Thông báo</h1>
          {result && result.total > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {result.unreadCount > 0 ? `${result.unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
            </p>
          )}
        </div>
        {result && result.unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {result === null ? (
          <ErrorNotice error={new Error("GET /api/notifications thất bại")} title="Không tải được thông báo" />
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">{page > 1 ? "Trang này không có thông báo" : "Chưa có thông báo nào"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.role === "employer"
                ? "Khi có ứng viên nộp hoặc rút đơn, bạn sẽ thấy ở đây."
                : "Khi nhà tuyển dụng xem đơn, đổi trạng thái hoặc hẹn phỏng vấn, bạn sẽ thấy ở đây."}
            </p>
          </div>
        ) : (
          <>
            <NotificationList notifications={result.data} />
            <Pagination page={page} totalPages={result.totalPages} basePath="/notifications" />
          </>
        )}
      </div>
    </div>
  );
}
