"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import { Field, errorProps } from "@/components/form-field";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { deleteRequest, errorMessage, putForm, putJson } from "@/lib/api-client";
import {
  accountSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type AccountValues,
  type ChangePasswordValues,
  type DeleteAccountValues,
} from "@/lib/validation/auth";
import { IMAGE_EXTENSIONS, validateImageFile } from "@/lib/validation/image";

type Status = { type: "success" | "error"; message: string } | null;

function Spinner() {
  return <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

// ===== Ảnh đại diện =====

// Khớp DEFAULT_AVATAR trong backend/src/config/paths.js
const DEFAULT_AVATAR = "default-avatar.jpg";

export function AvatarForm({ avatar }: { avatar: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<"upload" | "reset" | null>(null);

  // Trả true nếu thành công
  async function run(kind: "upload" | "reset", action: () => Promise<unknown>, success: string): Promise<boolean> {
    setStatus(null);
    setPending(kind);
    try {
      await action();
      setStatus({ type: "success", message: success });
      router.refresh(); // header cũng hiện avatar/tên nên phải render lại từ server
      return true;
    } catch (err) {
      setStatus({ type: "error", message: errorMessage(err) });
      return false;
    } finally {
      setPending(null);
    }
  }

  function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    const error = validateImageFile(file, "ảnh đại diện");
    setFileError(error);
    if (error || !file) return;

    const formData = new FormData();
    formData.append("avatar", file); // khớp avatarUpload.single('avatar') ở backend
    run("upload", () => putForm("/api/profiles/avatar", formData), "Đã cập nhật ảnh đại diện.").then((ok) => {
      if (ok && input.current) input.current.value = ""; // lỗi thì giữ file để người dùng thử lại
    });
  }

  return (
    <form onSubmit={upload} noValidate className="flex flex-col gap-4">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}
      <div className="flex items-center gap-4">
        <UserAvatar avatar={avatar} size="lg" />
        <p className="text-sm text-muted-foreground">JPG, PNG, GIF hoặc WEBP, tối đa 2MB.</p>
      </div>
      <Field id="avatar" label="Ảnh mới" error={fileError ?? undefined}>
        <Input
          ref={input}
          id="avatar"
          type="file"
          accept={IMAGE_EXTENSIONS.join(",")}
          className="h-11 py-2"
          onChange={() => setFileError(null)}
          {...errorProps(fileError, "avatar")}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending !== null}>
          {pending === "upload" && <Spinner />}
          {pending === "upload" ? "Đang tải lên…" : "Tải ảnh lên"}
        </Button>
        {avatar !== DEFAULT_AVATAR && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => run("reset", () => deleteRequest("/api/profiles/avatar"), "Đã dùng lại ảnh mặc định.")}
          >
            {pending === "reset" && <Spinner />}
            Dùng ảnh mặc định
          </Button>
        )}
      </div>
    </form>
  );
}

// ===== Thông tin tài khoản =====

export function AccountForm({
  name,
  email,
  phone,
  isJobseeker,
}: {
  name: string;
  email: string;
  phone?: string;
  isJobseeker: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name, phone: phone ?? "" },
  });

  async function onSubmit(values: AccountValues) {
    setStatus(null);
    try {
      await putJson("/api/auth/me", values);
      setStatus({ type: "success", message: "Đã lưu thông tin tài khoản." });
      router.refresh(); // tên trên header cập nhật
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}
      <Field id="email" label="Email" hint="Email dùng để đăng nhập, hiện chưa đổi được.">
        <Input id="email" type="email" className="h-11" value={email} readOnly disabled />
      </Field>
      <Field id="name" label="Tên hiển thị" error={errors.name?.message}>
        <Input id="name" autoComplete="name" className="h-11" {...register("name")} {...errorProps(errors.name, "name")} />
      </Field>
      <Field id="phone" label="Số điện thoại (không bắt buộc)" error={errors.phone?.message} hint={isJobseeker ? "Nhà tuyển dụng thấy số này khi bạn ứng tuyển." : undefined}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0901 234 567"
          className="h-11"
          {...register("phone")}
          {...errorProps(errors.phone, "phone")}
        />
      </Field>
      <Button type="submit" size="lg" className="h-11 self-start" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {isSubmitting ? "Đang lưu…" : "Lưu thông tin"}
      </Button>
    </form>
  );
}

// ===== Đổi mật khẩu =====

export function PasswordForm() {
  const [status, setStatus] = useState<Status>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const password = watch("password") ?? "";

  async function onSubmit(values: ChangePasswordValues) {
    setStatus(null);
    try {
      // Backend đổi mật khẩu, đăng xuất các thiết bị khác và set cookie mới cho phiên này
      const result = await putJson<{ message: string }>("/api/auth/password", {
        currentPassword: values.currentPassword,
        newPassword: values.password,
      });
      reset(); // xoá các ô mật khẩu
      setStatus({ type: "success", message: result.message });
    } catch (error) {
      const message = errorMessage(error);
      // Sai mật khẩu hiện tại thì báo ngay dưới ô đó, để người dùng biết sửa ô nào
      if (message === "Mật khẩu hiện tại không đúng") {
        setError("currentPassword", { message });
      } else {
        setStatus({ type: "error", message });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}
      <Field id="currentPassword" label="Mật khẩu hiện tại" error={errors.currentPassword?.message}>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          className="h-11"
          {...register("currentPassword")}
          {...errorProps(errors.currentPassword, "currentPassword")}
        />
      </Field>
      <Field id="password" label="Mật khẩu mới" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          className="h-11"
          aria-describedby={errors.password ? "password-error password-rules" : "password-rules"}
          aria-invalid={errors.password ? true : undefined}
          {...register("password")}
        />
        <PasswordChecklist id="password-rules" password={password} />
      </Field>
      <Field id="confirmPassword" label="Nhập lại mật khẩu mới" error={errors.confirmPassword?.message}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          className="h-11"
          {...register("confirmPassword")}
          {...errorProps(errors.confirmPassword, "confirmPassword")}
        />
      </Field>
      <p className="text-sm text-muted-foreground">Đổi xong, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
      <Button type="submit" size="lg" className="h-11 self-start" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {isSubmitting ? "Đang đổi…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}

// ===== Xoá tài khoản =====

// Những gì bị xoá theo, khớp backend/src/utils/deleteUserAccount.js
const DELETED_DATA: Record<"jobseeker" | "employer", string[]> = {
  jobseeker: ["Hồ sơ và CV", "Mọi đơn ứng tuyển (nhà tuyển dụng cũng không xem được nữa)", "Việc đã lưu"],
  employer: [
    "Thông tin công ty và logo",
    "Mọi tin tuyển dụng",
    "Toàn bộ đơn ứng viên đã nộp vào các tin đó (ứng viên cũng không xem được nữa)",
  ],
};

// Hành động không hoàn tác được: bấm 2 bước tại chỗ (DESIGN.md), bước 2 phải nhập mật khẩu.
// Admin không có khối này (backend trả 403).
export function DeleteAccountForm({ role }: { role: "jobseeker" | "employer" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  function cancel() {
    reset(); // không để lại mật khẩu đã gõ
    setServerError(null);
    setConfirming(false);
  }

  async function onSubmit(values: DeleteAccountValues) {
    setServerError(null);
    try {
      // Backend xoá tài khoản kèm toàn bộ dữ liệu và xoá cookie đăng nhập
      await deleteRequest("/api/auth/me", { password: values.password });
      router.push("/login?deleted=1");
      router.refresh(); // header không còn tên người dùng
    } catch (error) {
      const message = errorMessage(error);
      // Sai mật khẩu thì báo ngay dưới ô; lỗi khác (rate limit, mất kết nối) ở hộp phía trên
      if (message === "Mật khẩu không đúng") {
        setError("password", { message });
      } else {
        setServerError(message);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm">
        <p>Xoá vĩnh viễn tài khoản và mọi dữ liệu kèm theo, không khôi phục được:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {DELETED_DATA[role].map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>Thông báo và ảnh đại diện</li>
        </ul>
        {role === "employer" && (
          <p className="mt-3 text-muted-foreground">Chỉ muốn ngừng tuyển? Đổi các tin sang &quot;Đã đóng&quot; ở trang Tin tuyển dụng.</p>
        )}
      </div>

      {!confirming ? (
        <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          Xoá tài khoản
        </Button>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 border-t pt-4">
          {serverError && <FormAlert>{serverError}</FormAlert>}
          <Field id="deletePassword" label="Nhập mật khẩu để xác nhận" error={errors.password?.message}>
            <PasswordInput
              id="deletePassword"
              autoComplete="current-password"
              autoFocus // vừa bấm "Xoá tài khoản" thì gõ được ngay
              className="h-11"
              {...register("password")}
              {...errorProps(errors.password, "deletePassword")}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={cancel} disabled={isSubmitting}>
              Giữ tài khoản
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Đang xoá…" : "Xoá vĩnh viễn"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
