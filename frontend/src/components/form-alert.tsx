import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

// Hộp thông báo chung của form: lỗi từ server (sai mật khẩu, rate limit...) hoặc báo thành công.
// role="alert": trình đọc màn hình đọc ngay khi hộp xuất hiện.
export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = variant === "error" ? CircleAlert : CircleCheck;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-md border px-4 py-3 text-sm",
        variant === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-primary/40 bg-secondary text-secondary-foreground"
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
