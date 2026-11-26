import { z } from "zod";

const emailField = z.string().trim().min(1, "Vui lòng nhập email").pipe(z.email("Email không hợp lệ"));

// ===== Đăng nhập =====

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

// z.infer: TypeScript tự suy ra kiểu { email: string; password: string } từ schema
export type LoginValues = z.infer<typeof loginSchema>;

export const PASSWORD_RULES = [
  { label: "Ít nhất 8 ký tự", test: (value: string) => value.length >= 8 },
  { label: "1 chữ hoa (A-Z)", test: (value: string) => /[A-Z]/.test(value) },
  { label: "1 chữ số", test: (value: string) => /\d/.test(value) },
  { label: "1 ký tự đặc biệt (@$!%*?&#)", test: (value: string) => /[@$!%*?&#]/.test(value) },
] as const;

export function isStrongPassword(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

const newPasswordFields = {
  password: z.string().refine(isStrongPassword, "Mật khẩu chưa đủ mạnh"),
  confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu"),
};

// Kiểm tra 2 ô mật khẩu khớp nhau, dùng với .refine(passwordsMatch, PASSWORDS_MISMATCH).
const passwordsMatch = (values: { password: string; confirmPassword: string }) =>
  values.password === values.confirmPassword;

// path: gắn lỗi vào ô "Nhập lại mật khẩu" thay vì cả form
const PASSWORDS_MISMATCH = { error: "Mật khẩu nhập lại không khớp", path: ["confirmPassword"] };

// ===== Đăng ký =====

export const ROLES = ["jobseeker", "employer"] as const; // backend chỉ cho tự đăng ký 2 vai trò này
export type RegisterRole = (typeof ROLES)[number];

export const registerSchema = z
  .object({
    role: z.enum(ROLES),
    // Backend: name bắt buộc, tối đa 50 ký tự (models/User.js)
    name: z.string().trim().min(1, "Vui lòng nhập tên").max(50, "Tên không được quá 50 ký tự"),
    email: emailField,
    ...newPasswordFields, // trải (spread) 2 field password, confirmPassword vào đây
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);

export type RegisterValues = z.infer<typeof registerSchema>;

// ===== Quên mật khẩu, đặt lại mật khẩu =====

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object(newPasswordFields).refine(passwordsMatch, PASSWORDS_MISMATCH);
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// ===== Cài đặt tài khoản =====

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    ...newPasswordFields,
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH)
  .refine((values) => values.password !== values.currentPassword, {
    error: "Mật khẩu mới phải khác mật khẩu hiện tại",
    path: ["password"],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// Tự xoá tài khoản: chỉ cần mật khẩu hiện tại để xác nhận (DELETE /api/auth/me)
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Vui lòng nhập mật khẩu để xác nhận"),
});

export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

// Khớp backend authController.js (updateMe): tên ≤ 50; số điện thoại 8-20 ký tự gồm số, khoảng trắng, + ( ) . -
export const accountSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên").max(50, "Tên tối đa 50 ký tự"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^[0-9+().\s-]{8,20}$/.test(value) && (value.match(/\d/g) ?? []).length >= 8), {
      message: "Số điện thoại gồm ít nhất 8 chữ số, ví dụ 0901 234 567",
    }),
});
export type AccountValues = z.infer<typeof accountSchema>;
