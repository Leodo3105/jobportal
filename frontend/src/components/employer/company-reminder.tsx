import Link from "next/link";

// NTD mới đăng ký chưa có công ty: backend không cho đăng tin và chưa có số liệu tổng quan
export function CompanyReminder() {
  return (
    <div className="rounded-xl border border-primary/40 bg-secondary px-5 py-4 text-sm text-secondary-foreground">
      <p className="font-semibold">Tạo thông tin công ty để bắt đầu đăng tin</p>
      <p className="mt-1">Ứng viên sẽ thấy tên, logo và giới thiệu công ty ở mỗi tin tuyển dụng.</p>
      <Link href="/employer/company" className="mt-2 inline-block font-semibold text-primary hover:underline">
        Tạo thông tin công ty
      </Link>
    </div>
  );
}
