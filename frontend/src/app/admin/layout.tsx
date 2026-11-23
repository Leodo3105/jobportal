import type { Metadata } from "next";

import { AreaNav } from "@/components/layout/area-nav";
import { requireRole } from "@/lib/require-role";

export const metadata: Metadata = {
  robots: { index: false },
};

// Layout bọc mọi trang /admin/*: chỉ admin đã đăng nhập mới vào được.
// Backend vẫn tự kiểm tra quyền ở từng API (authorize('admin')); layout chỉ để chuyển trang cho đúng.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <AreaNav area="admin" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
