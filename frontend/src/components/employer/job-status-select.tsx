"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { errorMessage, putJson } from "@/lib/api-client";
import { JOB_STATUS_LABELS } from "@/lib/format";
import type { JobStatus } from "@/types/api";

// NTD tự chọn được 3 trạng thái. "expired" do hệ thống đặt, chỉ hiện khi tin đang ở trạng thái đó.
const CHOICES: JobStatus[] = ["active", "closed", "draft"];

export function JobStatusSelect({ jobId, jobTitle, status }: { jobId: string; jobTitle: string; status: JobStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = CHOICES.includes(status) ? CHOICES : [status, ...CHOICES];

  async function change(next: JobStatus) {
    setPending(true);
    setError(null);
    try {
      await putJson(`/api/jobs/${jobId}/status`, { status: next });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          // Nhãn ẩn đọc cả tên tin, vì trang có nhiều ô chọn giống nhau
          aria-label={`Trạng thái tin ${jobTitle}`}
          // key: khi đổi thất bại, render lại ô chọn để quay về trạng thái cũ
          key={`${status}-${error ?? ""}`}
          defaultValue={status}
          disabled={pending}
          onChange={(event) => change(event.target.value as JobStatus)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {options.map((value) => (
            <option key={value} value={value} disabled={value === "expired"}>
              {JOB_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-label="Đang lưu" />}
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
