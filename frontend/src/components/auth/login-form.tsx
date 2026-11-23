"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage, postAuth } from "@/lib/auth-client";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";
import type { AuthResponse } from "@/types/api";

// "use client": form cần chạy trong trình duyệt (gõ phím, bấm nút, đổi state).
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  // Lỗi chung từ server (sai mật khẩu, rate limit, mất kết nối), khác với lỗi từng ô
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, // nối một ô nhập vào form: đặt name, onChange, ref...
    handleSubmit, // chạy validate bằng Zod trước, hợp lệ mới gọi onSubmit
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      const { user } = await postAuth<AuthResponse>("login", {
        // Backend so khớp email phân biệt hoa thường, nên luôn gửi chữ thường
        email: values.email.toLowerCase(),
        password: values.password,
      });

      // replace thay vì push: bấm "Back" sẽ không quay lại trang đăng nhập
      router.replace(redirectAfterLogin(user.role, next));
      // Header là Server Component đã render từ trước, refresh để nó đọc cookie mới và hiện tên
      router.refresh();
    } catch (error) {
      // 401: backend cố ý không nói sai email hay sai mật khẩu, để kẻ xấu không dò được email nào có tài khoản
      if (error instanceof ApiError && error.status === 401) {
        setServerError("Email hoặc mật khẩu không đúng.");
      } else {
        setServerError(errorMessage(error));
      }
    }
  }

  return (
    // noValidate: tắt validate mặc định của trình duyệt, để Zod báo lỗi bằng tiếng Việt thống nhất
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email" // trình duyệt gợi ý email đã lưu
          inputMode="email" // điện thoại hiện bàn phím có @
          placeholder="ban@example.com"
          className="h-11"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password" // trình quản lý mật khẩu tự điền
          className="h-11"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Khoá nút khi đang gửi, tránh bấm 2 lần (lần thừa cũng bị tính vào rate limit) */}
      <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
