"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { errorMessage, putEmpty } from "@/lib/api-client";

// Rút đơn cần bấm 2 lần: lần đầu hiện câu hỏi xác nhận ngay tại chỗ, lần hai mới gửi.
// Không dùng window.confirm vì hộp thoại của trình duyệt không theo giao diện của trang.
export function WithdrawButton({ applicationId, jobTitle }: { applicationId: string; jobTitle: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    try {
      await putEmpty(`/api/applications/${applicationId}/cancel`);
      router.refresh(); // render lại danh sách từ server với trạng thái mới
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Rút đơn
      </Button>
    );
  }

  return (
    // role="group" + aria-label: trình đọc màn hình biết 2 nút này đi cùng câu hỏi nào
    <div role="group" aria-label={`Rút đơn ứng tuyển ${jobTitle}`} className="flex flex-col items-start gap-2">
      <p className="text-sm">Rút đơn này? Nhà tuyển dụng sẽ được thông báo. Bạn vẫn có thể nộp lại khi tin còn hạn.</p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={withdraw} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pending ? "Đang rút…" : "Rút đơn"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Giữ đơn
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
