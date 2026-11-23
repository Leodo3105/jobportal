import Link from "next/link";

import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <nav aria-label="Liên kết cuối trang" className="flex gap-6">
          <Link href="/jobs" className="hover:text-foreground">
            Việc làm
          </Link>
          <Link href="/companies" className="hover:text-foreground">
            Công ty
          </Link>
          <Link href="/register?role=employer" className="hover:text-foreground">
            Dành cho nhà tuyển dụng
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} JobPortal</p>
      </div>
    </footer>
  );
}
