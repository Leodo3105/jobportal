import type { Metadata } from "next";

import { ProfileForm } from "@/components/jobseeker/profile-form";
import { TimelineSection } from "@/components/jobseeker/timeline-section";
import { getCurrentUser, getMyProfile } from "@/lib/api";

export const metadata: Metadata = { title: "Hồ sơ của tôi" };

export default async function ProfilePage() {
  // Layout đã chắc chắn user là ứng viên; getCurrentUser được cache nên không gọi backend lần nữa
  const [user, profile] = await Promise.all([getCurrentUser(), getMyProfile()]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Hồ sơ của tôi</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Nhà tuyển dụng xem hồ sơ này cùng CV khi bạn ứng tuyển.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="general-heading" className="rounded-xl border bg-card p-6">
          <h2 id="general-heading" className="text-lg font-semibold">
            Thông tin chung
          </h2>
          <div className="mt-4">
            <ProfileForm profile={profile} userName={user?.name ?? ""} />
          </div>
        </section>

        <TimelineSection kind="experience" items={profile?.experience ?? []} enabled={profile !== null} />
        <TimelineSection kind="education" items={profile?.education ?? []} enabled={profile !== null} />
      </div>
    </div>
  );
}
