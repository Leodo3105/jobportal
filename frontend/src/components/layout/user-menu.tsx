"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

// Phần bên phải header khi đã đăng nhập: tên người dùng và nút Đăng xuất.
// areaHref: khu riêng của vai trò (ví dụ /jobseeker). Có thì tên người dùng thành link tới đó.
export function UserMenu({ name, areaHref }: { name: string; areaHref?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      // Backend xoá cookie "token"
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setPending(false);
      // Render lại các Server Component (header) để hiện lại nút Đăng nhập/Đăng ký
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {areaHref ? (
        <Link
          href={areaHref}
          className="max-w-32 truncate rounded-md text-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-48"
          title={`${name}: mở trang quản lý`}
        >
          {name}
        </Link>
      ) : (
        <span className="max-w-32 truncate text-sm font-medium sm:max-w-48" title={name}>
          {name}
        </span>
      )}
      <Button asChild variant="ghost" size="icon">
        <Link href="/account" aria-label="Cài đặt tài khoản" title="Cài đặt tài khoản">
          <Settings aria-hidden="true" />
        </Link>
      </Button>
      {/* Mobile chỉ hiện icon cho gọn; aria-label để trình đọc màn hình vẫn đọc được tên nút */}
      <Button variant="ghost" onClick={logout} disabled={pending} aria-label="Đăng xuất">
        <LogOut aria-hidden="true" />
        <span className="hidden sm:inline">Đăng xuất</span>
      </Button>
    </div>
  );
}
