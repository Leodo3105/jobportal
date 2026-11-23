import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { MonthlyBars, MonthlyTable, StatTile, TopList } from "@/components/dashboard/charts";
import { CompanyReminder } from "@/components/employer/company-reminder";
import { ErrorNotice } from "@/components/error-notice";
import { Button } from "@/components/ui/button";
import { getEmployerDashboard, getMyCompany } from "@/lib/api";
import { EMPLOYER_APPLICATION_STATUS_LABELS, JOB_STATUS_LABELS } from "@/lib/format";
import type { ApplicationStatus } from "@/types/api";

export const metadata: Metadata = { title: "Tổng quan tuyển dụng" };

const STATUS_ORDER: ApplicationStatus[] = ["pending", "viewed", "interview", "accepted", "rejected", "withdrawn"];

function Heading({ withPostButton }: { withPostButton: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Tổng quan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Số liệu các tin của công ty bạn, tính đến lúc mở trang.</p>
      </div>
      {withPostButton && (
        <Button asChild>
          <Link href="/employer/jobs/new">
            <Plus aria-hidden="true" />
            Đăng tin
          </Link>
        </Button>
      )}
    </div>
  );
}

export default async function EmployerDashboardPage() {
  // Dashboard trả 404 khi chưa có công ty; gọi thêm getMyCompany để phân biệt "chưa có công ty" với "lỗi"
  const [data, company] = await Promise.all([getEmployerDashboard(), getMyCompany()]);

  if (!company) {
    return (
      <div>
        <Heading withPostButton={false} />
        <div className="mt-6">
          <CompanyReminder />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Heading withPostButton />
        <div className="mt-6">
          <ErrorNotice error={new Error("GET /api/dashboard/employer thất bại")} title="Không tải được số liệu" />
        </div>
      </div>
    );
  }

  const { jobs, applications, charts, topJobs } = data;
  // Như trang "Tin tuyển dụng": số đơn không tính đơn ứng viên đã rút
  const received = applications.total - applications.withdrawn;
  // Tin "Đang tuyển" nhưng đã quá hạn nộp: ứng viên không còn thấy
  const overdue = jobs.active - jobs.open;
  const series = [
    { label: "Tin đăng mới", unit: "tin", values: charts.datasets.newJobs },
    { label: "Đơn ứng tuyển mới", unit: "đơn", values: charts.datasets.newApplications },
  ];
  const jobsWithApplications = topJobs.filter((job) => job.applicationsCount > 0);

  return (
    <div>
      <Heading withPostButton />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tin đang hiện" value={jobs.open} note={`trên tổng ${jobs.total} tin`} />
        <StatTile
          label="Đơn ứng tuyển"
          value={received}
          note={applications.withdrawn > 0 ? `không tính ${applications.withdrawn} đơn đã rút` : undefined}
        />
        <StatTile label="Đơn chưa xem" value={applications.pending} />
        <StatTile label="Đang mời phỏng vấn" value={applications.interview} />
      </div>

      {/* Việc NTD nên làm ngay */}
      {(applications.pending > 0 || overdue > 0) && (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {applications.pending > 0 && (
            <li>
              <Link href="/employer/jobs" className="font-semibold text-primary hover:underline">
                {applications.pending} đơn đang chờ bạn xem
              </Link>
              <span className="text-muted-foreground"> (số đơn chưa xem hiện ở từng tin)</span>
            </li>
          )}
          {overdue > 0 && (
            <li>
              <Link href="/employer/jobs" className="font-semibold text-primary hover:underline">
                {overdue} tin &quot;Đang tuyển&quot; đã quá hạn nộp
              </Link>
              <span className="text-muted-foreground"> (không còn hiện với ứng viên, cần gia hạn)</span>
            </li>
          )}
        </ul>
      )}

      <section aria-labelledby="top-heading" className="mt-10">
        <h2 id="top-heading" className="text-2xl font-bold">
          Tin nhiều đơn nhất
        </h2>
        {jobsWithApplications.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            Chưa có đơn ứng tuyển nào.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col divide-y rounded-xl border bg-card">
            {jobsWithApplications.map((job) => (
              <li key={job._id} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/employer/jobs/${job._id}`} className="font-semibold hover:text-primary hover:underline">
                    {job.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {JOB_STATUS_LABELS[job.status]} · {job.views.toLocaleString("vi-VN")} lượt xem
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  <span className="font-semibold">{job.applicationsCount}</span> đơn
                  {job.pendingCount > 0 && <span className="font-semibold text-primary">, {job.pendingCount} chưa xem</span>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="status-heading" className="mt-10">
        <h2 id="status-heading" className="text-2xl font-bold">
          Đơn theo trạng thái
        </h2>
        <div className="mt-4">
          <TopList
            title={`Tổng ${applications.total} đơn, kể cả đơn đã rút`}
            unit="đơn"
            empty="Chưa có đơn ứng tuyển nào."
            items={
              applications.total === 0
                ? []
                : STATUS_ORDER.map((status) => ({
                    name: EMPLOYER_APPLICATION_STATUS_LABELS[status],
                    count: applications[status],
                  }))
            }
          />
        </div>
      </section>

      <section aria-labelledby="monthly-heading" className="mt-10">
        <h2 id="monthly-heading" className="text-2xl font-bold">
          6 tháng gần nhất
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {series.map((item) => (
            <MonthlyBars key={item.label} title={item.label} unit={item.unit} months={charts.labels} values={item.values} />
          ))}
        </div>
        <div className="mt-4">
          <MonthlyTable months={charts.labels} rows={series.map(({ label, values }) => ({ label, values }))} />
        </div>
      </section>
    </div>
  );
}
