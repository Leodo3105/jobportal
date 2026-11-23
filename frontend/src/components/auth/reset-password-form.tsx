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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage, postAuth } from "@/lib/auth-client";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Link hết hạn hoặc đã dùng: hiện thêm nút gửi lại liên kết
  const [linkExpired, setLinkExpired] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" });

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null);
    setLinkExpired(false);
    try {
      // Token lấy từ link trong email, không phải người dùng gõ
      await postAuth<{ success: true; message: string }>("reset-password", { token, password: values.password });
      router.replace("/login?reset=success");
    } catch (error) {
      // 400 ở bước này: mật khẩu yếu (FE đã chặn trước) hoặc token sai/hết hạn/đã dùng
      if (error instanceof ApiError && error.status === 400 && error.message.includes("hết hạn")) {
        setLinkExpired(true);
      }
      setServerError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError && (
        <FormAlert>
          {serverError}
          {linkExpired && (
            <>
              {" "}
              <Link href="/forgot-password" className="font-semibold underline underline-offset-2">
                Gửi lại liên kết
              </Link>
            </>
          )}
        </FormAlert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mật khẩu mới</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          className="h-11"
          aria-invalid={errors.password ? true : undefined}
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
        <Label htmlFor="confirmPassword">Nhập lại mật khẩu mới</Label>
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
        {isSubmitting ? "Đang lưu…" : "Đặt lại mật khẩu"}
      </Button>
    </form>
  );
}
