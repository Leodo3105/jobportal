"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteRequest, errorMessage, putEmpty } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { notificationHref } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/api";

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {notifications.map((notification) => (
        <li key={notification._id}>
          <NotificationItem notification={notification} />
        </li>
      ))}
    </ul>
  );
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = notificationHref(notification.link);
  const unread = !notification.read;

  // Mở thông báo: đánh dấu đã đọc trước (nếu chưa đọc), rồi mới chuyển trang
  async function open() {
    if (unread) {
      try {
        await putEmpty(`/api/notifications/${notification._id}/read`);
      } catch {
        // Đánh dấu thất bại không nên chặn người dùng mở trang đích
      }
    }
    if (href) router.push(href);
    // Layout (chứa chuông trên header) được giữ nguyên khi chuyển trang, nên phải refresh
    // để số thông báo chưa đọc cập nhật
    router.refresh();
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deleteRequest(`/api/notifications/${notification._id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const content = (
    <>
      <span className="flex items-start gap-2">
        {/* Chấm xanh = chưa đọc. Có chữ ẩn cho trình đọc màn hình vì chấm chỉ là màu. */}
        <span
          className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className={cn("block", unread ? "font-semibold" : "font-medium text-muted-foreground")}>
            {unread && <span className="sr-only">Chưa đọc: </span>}
            {notification.title}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{notification.message}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</span>
        </span>
      </span>
    </>
  );

  return (
    <div className="flex items-start gap-2 p-4">
      <div className="min-w-0 flex-1">
        {href ? (
          // button chứ không phải Link: cần chạy "đánh dấu đã đọc" trước khi chuyển trang
          <button
            type="button"
            onClick={open}
            className="w-full rounded-md text-left outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {content}
          </button>
        ) : (
          <div>
            {content}
            {unread && (
              <Button variant="ghost" size="sm" className="mt-1 ml-4" onClick={open}>
                Đánh dấu đã đọc
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-1 ml-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={remove} disabled={pending} aria-label={`Xoá thông báo: ${notification.title}`}>
        {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markAll() {
    setPending(true);
    setError(null);
    try {
      await putEmpty("/api/notifications/read-all");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={markAll} disabled={pending}>
        {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Đánh dấu tất cả đã đọc
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
