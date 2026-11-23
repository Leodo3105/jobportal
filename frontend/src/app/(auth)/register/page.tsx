import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/api";
import { redirectAfterLogin, safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Đăng ký",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;

  // Đã đăng nhập thì không cần đăng ký nữa
  const user = await getCurrentUser();
  if (user) {
    redirect(redirectAfterLogin(user.role, next));
  }

  // Chỉ "employer" mới chọn sẵn Nhà tuyển dụng; thiếu hoặc giá trị lạ (kể cả "admin") thì là Ứng viên
  const initialRole = role === "employer" ? "employer" : "jobseeker";
  const nextParam = safeNext(next) ?? undefined;
  const loginHref = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login";

  return (
    <>
      <h1 className="text-3xl font-bold">Tạo tài khoản</h1>
      <p className="mt-2 text-muted-foreground">Miễn phí, chỉ mất một phút.</p>

      <div className="mt-8">
        <RegisterForm initialRole={initialRole} next={nextParam} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href={loginHref} className="font-semibold text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
