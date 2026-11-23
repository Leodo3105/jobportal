import type { Metadata } from "next";

import { AreaNav } from "@/components/layout/area-nav";
import { requireRole } from "@/lib/require-role";

export const metadata: Metadata = {
  robots: { index: false }, // trang riêng tư, không cho Google lập chỉ mục
};

// Layout bọc mọi trang /jobseeker/*: chỉ ứng viên đã đăng nhập mới vào được
export default async function JobseekerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("jobseeker");

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <AreaNav area="jobseeker" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
