import { Label } from "@/components/ui/label";

// Nhãn + ô nhập + gợi ý + câu lỗi. Có lỗi thì câu lỗi thay chỗ gợi ý.
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `flex flex-col gap-2 ${className}` : "flex flex-col gap-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// Gắn vào ô nhập: aria-invalid để viền đỏ, aria-describedby để trình đọc màn hình đọc câu lỗi
export function errorProps(error: unknown, id: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}
