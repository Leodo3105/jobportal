"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, FileText, LayoutDashboard, Send, Tags, UserRound, Users } from "lucide-react";

import { cn } from "@/lib/utils";

// Menu bên trái của các khu riêng. Danh sách link khai báo ở đây (không truyền từ Server Component),
// vì icon là component (hàm) mà Server Component không truyền hàm sang Client Component được.
const AREAS = {
  jobseeker: {
    label: "Khu ứng viên",
    links: [
      { href: "/jobseeker/applications", label: "Đơn ứng tuyển", Icon: Send },
      { href: "/jobseeker/profile", label: "Hồ sơ", Icon: UserRound },
      { href: "/jobseeker/cv", label: "CV của tôi", Icon: FileText },
    ],
  },
  employer: {
    label: "Khu nhà tuyển dụng",
    links: [
      { href: "/employer", label: "Tổng quan", Icon: LayoutDashboard, exact: true },
      // Trang đơn (/employer/applications/...) thuộc về mục "Tin tuyển dụng"
      { href: "/employer/jobs", label: "Tin tuyển dụng", Icon: Briefcase, alsoActive: ["/employer/applications"] },
      { href: "/employer/company", label: "Công ty", Icon: Building2 },
    ],
  },
  admin: {
    label: "Khu quản trị",
    links: [
      { href: "/admin", label: "Tổng quan", Icon: LayoutDashboard, exact: true },
      { href: "/admin/users", label: "Người dùng", Icon: Users },
      { href: "/admin/jobs", label: "Tin tuyển dụng", Icon: Briefcase },
      { href: "/admin/companies", label: "Công ty", Icon: Building2 },
      { href: "/admin/categories", label: "Danh mục", Icon: Tags },
    ],
  },
} as const;

export function AreaNav({ area }: { area: keyof typeof AREAS }) {
  const pathname = usePathname();
  const { label, links } = AREAS[area];

  return (
    <nav aria-label={label}>
      {/* Điện thoại: hàng ngang cuộn được. Màn hình lớn: cột dọc bên trái. */}
      <ul className="-mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:px-0">
        {links.map((link) => {
          const { href, label: text, Icon } = link;
          const extra: readonly string[] = "alsoActive" in link ? link.alsoActive : [];
          // exact: chỉ sáng khi đúng trang đó (/admin không sáng ở /admin/users)
          const active =
            "exact" in link && link.exact ? pathname === href : [href, ...extra].some((prefix) => pathname.startsWith(prefix));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
