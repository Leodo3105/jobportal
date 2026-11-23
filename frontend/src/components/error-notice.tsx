// Hiện khi không lấy được dữ liệu từ backend.
// Lúc dev thì kèm gợi ý cách sửa; bản production chỉ hiện câu thông báo.
interface ErrorNoticeProps {
  error: unknown;
  title?: string;
}

export function ErrorNotice({ error, title = "Không tải được danh sách việc làm" }: ErrorNoticeProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-6">
      <p className="font-semibold text-destructive">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">Tải lại trang sau ít phút.</p>
      {isDev && (
        <p className="mt-3 text-sm">
          Gợi ý khi dev: kiểm tra backend đã chạy ở cổng 5000 chưa (<code>cd backend</code>,{" "}
          <code>npm run dev</code>). Lỗi: {error instanceof Error ? error.message : String(error)}
        </p>
      )}
    </div>
  );
}
