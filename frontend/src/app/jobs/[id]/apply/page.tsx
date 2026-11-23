import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ApplyForm } from "@/components/apply/apply-form";
import { ErrorNotice } from "@/components/error-notice";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { getCurrentUser, getJob, getMyApplicationForJob, getMyProfileCv } from "@/lib/api";
import { isJobOpen } from "@/lib/format";
import type { JobDetail } from "@/types/api";

export const metadata: Metadata = {
  title: "Ứng tuyển",
  robots: { index: false }, // trang cần đăng nhập, không cho Google lập chỉ mục
};

interface ApplyPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const jobUrl = `/jobs/${id}`;

  // 1. Phải đăng nhập bằng tài khoản ứng viên
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`${jobUrl}/apply`)}`);
  if (user.role !== "jobseeker") redirect(jobUrl); // trang chi tiết đã có ghi chú cho NTD/admin

  // 2. Tin phải tồn tại và còn nhận hồ sơ
  let job: JobDetail | null;
  try {
    job = await getJob(id);
  } catch (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <ErrorNotice error={error} title="Không tải được tin tuyển dụng" />
      </div>
    );
  }
  if (!job) notFound();
  if (!isJobOpen(job)) redirect(jobUrl);

  // 3. Chưa nộp, hoặc đơn cũ đã rút (được nộp lại)
  const [existing, profileCv] = await Promise.all([getMyApplicationForJob(id), getMyProfileCv()]);
  if (existing && existing.status !== "withdrawn") redirect(jobUrl);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href={jobUrl}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Quay lại tin tuyển dụng
      </Link>

      <h1 className="mt-4 text-3xl font-bold">{existing ? "Ứng tuyển lại" : "Ứng tuyển"}</h1>

      <div className="mt-4 flex items-center gap-3">
        <CompanyLogo logo={job.company?.logo} />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{job.title}</p>
          <p className="text-sm text-muted-foreground">{job.company?.name ?? "Công ty ẩn danh"}</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border bg-card p-6">
        <ApplyForm jobId={id} profileCv={profileCv} />
      </div>
    </div>
  );
}
