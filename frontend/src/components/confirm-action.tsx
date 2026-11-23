"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";

export function Spinner() {
  return <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

// Gửi request rồi render lại trang; giữ câu lỗi để hiện ngay dưới nút
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}

// Hành động khó hoàn tác: bấm lần đầu hiện câu hỏi, lần hai mới chạy (quy tắc trong DESIGN.md)
export function ConfirmAction({
  trigger,
  triggerStyle = "button",
  question,
  hint,
  confirmLabel,
  keepLabel,
  groupLabel,
  onConfirm,
}: {
  trigger: string;
  // "link": nút trông như link chữ, dùng khi nằm cùng hàng với các link khác
  triggerStyle?: "button" | "link";
  question: string;
  hint?: string; // câu gợi ý cách khác, hiện mờ dưới câu hỏi
  confirmLabel: string;
  keepLabel: string;
  groupLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return triggerStyle === "link" ? (
      <button
        type="button"
        className="font-semibold text-muted-foreground hover:text-destructive hover:underline"
        onClick={() => setConfirming(true)}
      >
        {trigger}
      </button>
    ) : (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <div role="group" aria-label={groupLabel} className="flex max-w-sm flex-col items-end gap-2 text-right">
      <p className="text-sm font-normal text-foreground">{question}</p>
      {hint && <p className="text-sm font-normal text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          {keepLabel}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => run(onConfirm)} disabled={pending}>
          {pending && <Spinner />}
          {confirmLabel}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}
