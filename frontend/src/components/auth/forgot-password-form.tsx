"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, postAuth } from "@/lib/auth-client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  // Câu thông báo backend trả về khi gửi thành công. Có giá trị thì thay form bằng thông báo.
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null);
    try {
      // Backend luôn trả cùng một câu dù email có tồn tại hay không (chống dò email),
      // nên ở đây cũng chỉ hiện đúng câu đó, không nói "email không tồn tại".
      const { message } = await postAuth<{ success: true; message: string }>("forgot-password", {
        email: values.email.toLowerCase(),
      });
      setSentMessage(message);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  if (sentMessage) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert variant="success">{sentMessage}</FormAlert>
        <p className="text-sm text-muted-foreground">
          Liên kết có hiệu lực trong 15 phút. Không thấy email? Kiểm tra thư mục Spam.
        </p>
        <Button asChild size="lg" className="h-11 text-base">
          <Link href="/login">Quay lại đăng nhập</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError && <FormAlert>{serverError}</FormAlert>}

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
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang gửi…" : "Gửi hướng dẫn"}
      </Button>
    </form>
  );
}
