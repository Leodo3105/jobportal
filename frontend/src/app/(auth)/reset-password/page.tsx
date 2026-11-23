import type { Metadata } from "next";
import Link from "next/link";

import { FormAlert } from "@/components/form-alert";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
  // Không để Google lưu trang này (URL chứa token bí mật)
  robots: { index: false, follow: false },
};

// Trang người dùng mở từ link trong email: /reset-password?token=...
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <>
      <h1 className="text-3xl font-bold">Đặt lại mật khẩu</h1>

      {token ? (
        <>
          <p className="mt-2 text-muted-foreground">Chọn mật khẩu mới cho tài khoản của bạn.</p>
          <div className="mt-8">
            <ResetPasswordForm token={token} />
          </div>
        </>
      ) : (
        // Mở trang trực tiếp, hoặc link bị cắt mất phần ?token=
        <div className="mt-8 flex flex-col gap-5">
          <FormAlert>Liên kết không hợp lệ. Hãy mở đúng liên kết trong email, hoặc gửi lại liên kết mới.</FormAlert>
          <Button asChild size="lg" className="h-11 text-base">
            <Link href="/forgot-password">Gửi lại liên kết</Link>
          </Button>
        </div>
      )}
    </>
  );
}
