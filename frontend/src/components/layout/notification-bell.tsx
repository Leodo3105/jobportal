import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

// Chuông trên header, kèm số thông báo chưa đọc. Server Component: số được tính lúc render,
// chưa tự cập nhật khi có thông báo mới (cần realtime, xem NOTES mục 8).
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const label = unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo";

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/notifications" aria-label={label} title={label}>
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
