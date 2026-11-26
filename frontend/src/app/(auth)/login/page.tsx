import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormAlert } from "@/components/form-alert";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/api";
import { redirectAfterLogin, safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Đăng nhập", // layout gốc thêm đuôi thành "Đăng nhập | JobPortal"
};

// Server Component: chạy trên server trước, rồi mới gửi HTML về trình duyệt.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; deleted?: string }>;
}) {
  const { next, reset, deleted } = await searchParams;

  // Đã đăng nhập rồi thì không cần trang này nữa, chuyển đi luôn
  const user = await getCurrentUser();
  if (user) {
    redirect(redirectAfterLogin(user.role, next));
  }

  // Giữ ?next= khi chuyển sang trang đăng ký, để đăng ký xong cũng quay về đúng chỗ
  const nextParam = safeNext(next);
  const registerHref = nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register";

  return (
    <>
      <h1 className="text-3xl font-bold">Đăng nhập</h1>
      <p className="mt-2 text-muted-foreground">Chào mừng bạn quay lại JobPortal.</p>

      {/* Vừa đặt lại mật khẩu xong (chuyển từ /reset-password sang) */}
      {reset === "success" && (
        <div className="mt-6">
          <FormAlert variant="success">Đặt lại mật khẩu thành công. Đăng nhập bằng mật khẩu mới.</FormAlert>
        </div>
      )}
      {/* Vừa tự xoá tài khoản ở /account (backend đã xoá cookie) */}
      {deleted === "1" && (
        <div className="mt-6">
          <FormAlert variant="success">Tài khoản của bạn đã được xoá.</FormAlert>
        </div>
      )}

      <div className="mt-8">
        <LoginForm next={nextParam ?? undefined} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link href={registerHref} className="font-semibold text-primary hover:underline">
          Đăng ký
        </Link>
      </p>
    </>
  );
}
