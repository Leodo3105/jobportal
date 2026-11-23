"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import { RolePicker } from "@/components/auth/role-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage, postAuth } from "@/lib/auth-client";
import { redirectAfterLogin } from "@/lib/auth-redirect";
import { registerSchema, type RegisterRole, type RegisterValues } from "@/lib/validation/auth";
import type { AuthResponse } from "@/types/api";

const EMAIL_TAKEN = "Email đã được sử dụng";

export function RegisterForm({ initialRole, next }: { initialRole: RegisterRole; next?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError, // gắn lỗi từ server vào một ô cụ thể (ở đây: ô Email)
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole, name: "", email: "", password: "", confirmPassword: "" },
  });

  // useWatch: đọc giá trị hiện tại của ô và render lại khi ô đó đổi
  // (cần cho checklist mật khẩu và nhãn ô tên đổi theo vai trò)
  const role = useWatch({ control, name: "role" });
  const password = useWatch({ control, name: "password" });

  // Đổi vai trò thì đổi luôn URL (?role=employer), để copy link vẫn giữ lựa chọn.
  // replace: không thêm một mục vào lịch sử, bấm Back không phải lùi qua từng lần đổi.
  const roleField = register("role", {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams();
      if (event.target.value === "employer") params.set("role", "employer");
      if (next) params.set("next", next);
      const query = params.toString();
      router.replace(query ? `/register?${query}` : "/register", { scroll: false });
    },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    try {
      const { user } = await postAuth<AuthResponse>("register", {
        role: values.role,
        name: values.name,
        email: values.email.toLowerCase(), // backend phân biệt hoa thường, luôn gửi chữ thường
        password: values.password,
        // confirmPassword chỉ để kiểm tra ở FE, không gửi lên backend
      });

      // Backend đã set cookie: đăng ký xong là đăng nhập luôn
      router.replace(redirectAfterLogin(user.role, next));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.message === EMAIL_TAKEN) {
        // type "taken": để bên dưới biết mà hiện thêm link Đăng nhập
        setError("email", { type: "taken", message: "Email này đã có tài khoản." }, { shouldFocus: true });
      } else {
        setServerError(errorMessage(error));
      }
    }
  }

  const nameLabel = role === "employer" ? "Tên người liên hệ" : "Họ và tên";
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <RolePicker value={role} field={roleField} />

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{nameLabel}</Label>
        <Input
          id="name"
          autoComplete="name"
          className="h-11"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ban@example.com"
          className="h-11"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
            {errors.email.type === "taken" && (
              <>
                {" "}
                <Link href={loginHref} className="font-semibold underline underline-offset-2">
                  Đăng nhập?
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password" // trình duyệt gợi ý tạo mật khẩu mạnh
          className="h-11"
          aria-invalid={errors.password ? true : undefined}
          // Trình đọc màn hình đọc cả checklist khi focus vào ô này
          aria-describedby={errors.password ? "password-rules password-error" : "password-rules"}
          {...register("password")}
        />
        <PasswordChecklist id="password-rules" password={password} />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          className="h-11"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirm-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
