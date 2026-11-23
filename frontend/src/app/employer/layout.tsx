import type { Metadata } from "next";

import { AreaNav } from "@/components/layout/area-nav";
import { requireRole } from "@/lib/require-role";

export const metadata: Metadata = {
  robots: { index: false },
};

// Layout bọc mọi trang /employer/*: chỉ nhà tuyển dụng đã đăng nhập mới vào được
export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("employer");

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <AreaNav area="employer" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
