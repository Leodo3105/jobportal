import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountForm, AvatarForm, DeleteAccountForm, PasswordForm } from "@/components/account/account-forms";
import { getCurrentUser } from "@/lib/api";

export const metadata: Metadata = {
  title: "Cài đặt tài khoản",
  robots: { index: false },
};

// Dùng chung cho mọi vai trò. Middleware đã chặn khi thiếu cookie; ở đây kiểm tra token còn hợp lệ.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account")}`);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-bold">Cài đặt tài khoản</h1>

      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="avatar-heading" className="rounded-xl border bg-card p-6">
          <h2 id="avatar-heading" className="text-lg font-semibold">
            Ảnh đại diện
          </h2>
          <div className="mt-4">
            <AvatarForm avatar={user.avatar} />
          </div>
        </section>

        <section aria-labelledby="info-heading" className="rounded-xl border bg-card p-6">
          <h2 id="info-heading" className="text-lg font-semibold">
            Thông tin tài khoản
          </h2>
          <div className="mt-4">
            <AccountForm name={user.name} email={user.email} phone={user.phone} isJobseeker={user.role === "jobseeker"} />
          </div>
        </section>

        <section aria-labelledby="password-heading" className="rounded-xl border bg-card p-6">
          <h2 id="password-heading" className="text-lg font-semibold">
            Đổi mật khẩu
          </h2>
          <div className="mt-4">
            <PasswordForm />
          </div>
        </section>

        {/* Admin không tự xoá được (backend trả 403), nên không hiện khối này */}
        {user.role !== "admin" && (
          <section aria-labelledby="delete-heading" className="rounded-xl border border-destructive/40 bg-card p-6">
            <h2 id="delete-heading" className="text-lg font-semibold text-destructive">
              Xoá tài khoản
            </h2>
            <div className="mt-4">
              <DeleteAccountForm role={user.role} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
