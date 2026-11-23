import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
};

// Không chuyển trang khi đã đăng nhập: người đã đăng nhập vẫn có thể muốn đặt lại mật khẩu.
export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Quên mật khẩu</h1>
      <p className="mt-2 text-muted-foreground">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Nhớ ra mật khẩu rồi?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
