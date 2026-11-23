import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";

import { ErrorNotice } from "@/components/error-notice";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { getJobApplications, getMyJobs } from "@/lib/api";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VARIANT,
  EMPLOYER_APPLICATION_STATUS_LABELS as LABELS,
  JOB_STATUS_LABELS,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types/api";

export const metadata: Metadata = { title: "Đơn ứng tuyển theo tin" };

// Các tab lọc. "all" không tính đơn đã rút (NTD không xử lý được đơn đã rút).
const FILTERS: { value: "all" | ApplicationStatus; label: string }[] = [
  { value: "all", label: "Tất cả" },
  ...(["pending", "viewed", "interview", "accepted", "rejected", "withdrawn"] as const).map((value) => ({
    value,
    label: LABELS[value],
  })),
];

interface JobApplicationsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function JobApplicationsPage({ params, searchParams }: JobApplicationsPageProps) {
  const { id } = await params;
  const { status: statusParam } = await searchParams;
  const filter = FILTERS.find((f) => f.value === statusParam)?.value ?? "all";

  // Lấy thông tin tin từ danh sách tin của mình, không gọi GET /api/jobs/:id
  // (API đó tăng lượt xem và trả 404 cho tin nháp)
  const [jobs, applications] = await Promise.all([getMyJobs(), getJobApplications(id)]);
  const job = jobs?.find((item) => item._id === id);
  if (jobs && !job) notFound(); // không phải tin của mình hoặc không tồn tại

  const countOf = (value: (typeof FILTERS)[number]["value"]) =>
    applications?.filter((a) => (value === "all" ? a.status !== "withdrawn" : a.status === value)).length ?? 0;
  const shown = applications?.filter((a) => (filter === "all" ? a.status !== "withdrawn" : a.status === filter)) ?? [];

  return (
    <div>
      <Link
        href="/employer/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Tất cả tin tuyển dụng
      </Link>

      <h1 className="mt-4 text-3xl font-bold leading-tight">{job?.title ?? "Đơn ứng tuyển"}</h1>
      {job && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {job.location}
          </span>
          <span>{JOB_STATUS_LABELS[job.status]}</span>
        </p>
      )}

      {applications === null ? (
        <div className="mt-6">
          <ErrorNotice error={new Error(`GET /api/applications/job/${id} thất bại`)} title="Không tải được danh sách đơn" />
        </div>
      ) : (
        <>
          {/* Lọc bằng link (?status=...) để lọc xong vẫn chia sẻ/tải lại được trang */}
          <nav aria-label="Lọc theo trạng thái" className="-mx-5 mt-6 overflow-x-auto px-5">
            <ul className="flex gap-1 border-b">
              {FILTERS.map((f) => {
                const active = f.value === filter;
                return (
                  <li key={f.value}>
                    <Link
                      href={f.value === "all" ? `/employer/jobs/${id}` : `/employer/jobs/${id}?status=${f.value}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                      <span className="text-xs text-muted-foreground">{countOf(f.value)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6">
            {shown.length === 0 ? (
              <div className="rounded-xl border border-dashed px-5 py-12 text-center">
                <p className="font-semibold">{filter === "all" ? "Chưa có đơn ứng tuyển" : "Không có đơn ở trạng thái này"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "all" ? "Đơn mới sẽ hiện ở đây, kèm thông báo cho bạn." : "Chọn tab khác để xem các đơn còn lại."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {shown.map((application) => (
                  <li key={application._id} className="relative flex items-center gap-4 p-4 hover:bg-accent/50">
                    <UserAvatar avatar={application.user?.avatar} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {/* Cả hàng bấm được nhưng chỉ có một link (giống job-card.tsx) */}
                        <Link
                          href={`/employer/applications/${application._id}`}
                          className="outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                        >
                          {application.user?.name ?? "Tài khoản đã bị xoá"}
                        </Link>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[application.profile?.title, application.profile?.location].filter(Boolean).join(", ") || "Chưa có hồ sơ"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={APPLICATION_STATUS_VARIANT[application.status]}>
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(application.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
