import type { Metadata } from "next";
import Link from "next/link";

import { DeleteJobButton, JobFeaturedToggle } from "@/components/admin/admin-actions";
import { FilterForm } from "@/components/admin/filter-form";
import { JobStatusSelect } from "@/components/employer/job-status-select";
import { ErrorNotice } from "@/components/error-notice";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Pagination } from "@/components/jobs/pagination";
import { getAdminJobs } from "@/lib/api";
import { JOB_STATUS_LABELS, formatDate, isJobOpen } from "@/lib/format";
import type { JobStatus } from "@/types/api";

export const metadata: Metadata = { title: "Quản lý tin tuyển dụng" };

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export default async function AdminJobsPage({ searchParams }: PageProps) {
  const { search, status, page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const filters = { search, status };
  const result = await getAdminJobs({ ...filters, page });

  return (
    <div>
      <h1 className="text-3xl font-bold">Tin tuyển dụng</h1>
      {result && <p className="mt-1 text-sm text-muted-foreground">{result.total} tin, gồm cả tin nháp và đã đóng.</p>}

      <div className="mt-6">
        <FilterForm
          action="/admin/jobs"
          searchPlaceholder="Tiêu đề tin"
          search={search}
          selects={[
            {
              name: "status",
              label: "Trạng thái",
              value: status,
              options: [
                { value: "", label: "Mọi trạng thái" },
                ...(Object.entries(JOB_STATUS_LABELS) as [JobStatus, string][]).map(([value, label]) => ({ value, label })),
              ],
            },
          ]}
        />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {result === null ? (
          <ErrorNotice error={new Error("GET /api/admin/jobs thất bại")} title="Không tải được danh sách tin" />
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Không có tin nào khớp bộ lọc</p>
            <p className="mt-1 text-sm text-muted-foreground">Thử bỏ bớt điều kiện lọc.</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {result.data.map((job) => (
                <li key={job._id} className="flex flex-wrap items-start gap-4 p-4">
                  <CompanyLogo logo={job.company?.logo} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">
                      {/* Chỉ tin đang mở mới có trang công khai (tin nháp trả 404) */}
                      {isJobOpen(job) ? (
                        <Link href={`/jobs/${job._id}`} className="hover:text-primary hover:underline">
                          {job.title}
                        </Link>
                      ) : (
                        job.title
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {job.company?.name ?? "Công ty đã bị xoá"}
                      {job.user && <span>, đăng bởi {job.user.email}</span>}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Đăng ngày {formatDate(job.createdAt)}, hạn nộp {formatDate(job.applicationDeadline)}, {job.views.toLocaleString("vi-VN")} lượt xem
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <JobStatusSelect jobId={job._id} jobTitle={job.title} status={job.status} />
                    <JobFeaturedToggle jobId={job._id} title={job.title} featured={job.featured} />
                    <DeleteJobButton jobId={job._id} title={job.title} />
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={result.totalPages} searchParams={filters} basePath="/admin/jobs" />
          </>
        )}
      </div>
    </div>
  );
}
