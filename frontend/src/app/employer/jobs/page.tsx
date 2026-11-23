import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Eye, MapPin, Plus, Users } from "lucide-react";

import { CompanyReminder } from "@/components/employer/company-reminder";
import { DeleteJobButton } from "@/components/employer/delete-job-button";
import { JobStatusSelect } from "@/components/employer/job-status-select";
import { ErrorNotice } from "@/components/error-notice";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { getMyCompany, getMyJobs } from "@/lib/api";
import { formatDate, isJobOpen } from "@/lib/format";

export const metadata: Metadata = { title: "Tin tuyển dụng của tôi" };

interface EmployerJobsPageProps {
  searchParams: Promise<{ saved?: string }>; // ?saved=created|updated sau khi lưu form tin
}

export default async function EmployerJobsPage({ searchParams }: EmployerJobsPageProps) {
  const { saved } = await searchParams;
  const [jobs, company] = await Promise.all([getMyJobs(), getMyCompany()]);
  const totalPending = jobs?.reduce((sum, job) => sum + job.pendingCount, 0) ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tin tuyển dụng</h1>
          {jobs && jobs.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {jobs.length} tin{totalPending > 0 && `, ${totalPending} đơn chưa xem`}.
            </p>
          )}
        </div>
        {company && (
          <Button asChild>
            <Link href="/employer/jobs/new">
              <Plus aria-hidden="true" />
              Đăng tin
            </Link>
          </Button>
        )}
      </div>

      {saved === "created" && (
        <div className="mt-4">
          <FormAlert variant="success">Đã đăng tin. Tin đã hiện với ứng viên.</FormAlert>
        </div>
      )}
      {saved === "updated" && (
        <div className="mt-4">
          <FormAlert variant="success">Đã lưu thay đổi.</FormAlert>
        </div>
      )}

      {/* NTD mới đăng ký chưa có công ty: backend không cho đăng tin */}
      {!company && (
        <div className="mt-4">
          <CompanyReminder />
        </div>
      )}

      <div className="mt-6">
        {jobs === null ? (
          <ErrorNotice error={new Error("GET /api/jobs/employer/myjobs thất bại")} title="Không tải được danh sách tin" />
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Bạn chưa có tin tuyển dụng nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {company ? "Đăng tin đầu tiên để bắt đầu nhận hồ sơ." : "Tạo thông tin công ty trước, rồi đăng tin."}
            </p>
            {company && (
              <Button asChild className="mt-5">
                <Link href="/employer/jobs/new">Đăng tin</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {jobs.map((job) => {
              const open = isJobOpen(job);
              // Tin "Đang tuyển" nhưng đã qua hạn nộp: không ai thấy tin, cần nhắc NTD
              const overdue = job.status === "active" && !open;
              return (
                <li key={job._id} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold leading-snug">
                        <Link href={`/employer/jobs/${job._id}`} className="hover:text-primary hover:underline">
                          {job.title}
                        </Link>
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {job.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          Hạn nộp {formatDate(job.applicationDeadline)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" aria-hidden="true" />
                          {job.views.toLocaleString("vi-VN")} lượt xem
                        </span>
                      </p>
                    </div>
                    <JobStatusSelect jobId={job._id} jobTitle={job.title} status={job.status} />
                  </div>

                  {overdue && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      Tin đã qua hạn nộp nên không còn hiện với ứng viên.{" "}
                      <Link href={`/employer/jobs/${job._id}/edit`} className="font-semibold underline">
                        Gia hạn
                      </Link>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="flex items-center gap-2 text-sm">
                      <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>
                        <span className="font-semibold">{job.applicationCount}</span> đơn ứng tuyển
                        {job.pendingCount > 0 && (
                          <span className="font-semibold text-primary">, {job.pendingCount} chưa xem</span>
                        )}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-start justify-end gap-4 text-sm font-semibold">
                      <DeleteJobButton jobId={job._id} title={job.title} applicationCount={job.applicationCount} />
                      {open && (
                        <Link href={`/jobs/${job._id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                          Xem tin công khai
                        </Link>
                      )}
                      <Link href={`/employer/jobs/${job._id}/edit`} className="text-muted-foreground hover:text-foreground hover:underline">
                        Sửa tin
                      </Link>
                      <Link href={`/employer/jobs/${job._id}`} className="text-primary hover:underline">
                        Xem đơn ứng tuyển
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
