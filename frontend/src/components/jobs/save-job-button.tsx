"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError, deleteRequest, postJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SaveJobButtonProps {
  jobId: string;
  jobTitle: string;
  mode: "guest" | "jobseeker"; // NTD/admin thì không render nút này
  initialSaved: boolean;
  variant: "icon" | "full"; // icon: trên thẻ tin; full: nút có chữ ở trang chi tiết
}

// Nút "Lưu tin". Ứng viên: đổi trạng thái ngay (optimistic) rồi mới gọi API, lỗi thì quay lại.
// Khách: bấm thì sang trang đăng nhập, đăng nhập xong quay về trang đang xem.
export function SaveJobButton({ jobId, jobTitle, mode, initialSaved, variant }: SaveJobButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (mode === "guest") {
      const here = window.location.pathname + window.location.search;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }

    const next = !saved;
    setSaved(next);
    setFailed(false);
    setPending(true);
    try {
      if (next) {
        await postJson(`/api/saved-jobs/${jobId}`, {});
      } else {
        await deleteRequest(`/api/saved-jobs/${jobId}`);
      }
    } catch (error) {
      // 400 "đã được lưu" khi lưu, 404 "chưa được lưu" khi bỏ lưu: trạng thái trên server đã đúng như mong muốn
      // (ví dụ đã bấm ở tab khác), nên giữ nguyên. Lỗi khác thì quay về trạng thái cũ.
      const alreadyThere = error instanceof ApiError && error.status === (next ? 400 : 404);
      if (!alreadyThere) {
        setSaved(!next);
        setFailed(true);
      }
    } finally {
      setPending(false);
    }
  }

  const label = saved ? `Bỏ lưu tin ${jobTitle}` : `Lưu tin ${jobTitle}`;
  const icon = pending ? (
    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
  ) : (
    <Bookmark className={cn("size-4", saved && "fill-current text-primary")} aria-hidden="true" />
  );
  const error = failed && (
    <p role="alert" className="text-xs text-destructive">
      Không lưu được, thử lại
    </p>
  );

  if (variant === "icon") {
    return (
      // relative z-10: nằm trên link phủ cả thẻ, nên bấm nút không mở trang chi tiết
      <div className="relative z-10 flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          disabled={pending}
          aria-pressed={mode === "jobseeker" ? saved : undefined}
          aria-label={label}
          title={saved ? "Bỏ lưu" : "Lưu tin"}
        >
          {icon}
        </Button>
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full"
        onClick={toggle}
        disabled={pending}
        aria-pressed={mode === "jobseeker" ? saved : undefined}
        aria-label={label}
      >
        {icon}
        {saved ? "Đã lưu" : "Lưu tin"}
      </Button>
      {error}
    </div>
  );
}
