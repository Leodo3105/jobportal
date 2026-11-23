import type { Metadata } from "next";
import Link from "next/link";

import { MonthlyBars, MonthlyTable, StatTile, TopList } from "@/components/dashboard/charts";
import { ErrorNotice } from "@/components/error-notice";
import { getAdminDashboard } from "@/lib/api";

export const metadata: Metadata = { title: "Tổng quan quản trị" };

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();

  if (!data) {
    return (
      <div>
        <h1 className="text-3xl font-bold">Tổng quan</h1>
        <div className="mt-6">
          <ErrorNotice error={new Error("GET /api/dashboard/admin thất bại")} title="Không tải được số liệu" />
        </div>
      </div>
    );
  }

  const { users, jobs, applications, companies, profiles, charts, popular } = data;
  const months = charts.labels;
  const series = [
    { label: "Người dùng mới", unit: "người dùng", values: charts.datasets.newUsers },
    { label: "Tin đăng mới", unit: "tin", values: charts.datasets.newJobs },
    { label: "Đơn ứng tuyển mới", unit: "đơn", values: charts.datasets.newApplications },
  ];
  // Việc admin nên xem ngay: tài khoản bị khoá, tin đang tuyển nhưng đã quá hạn
  const overdue = jobs.active - jobs.open;

  return (
    <div>
      <h1 className="text-3xl font-bold">Tổng quan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Số liệu toàn hệ thống, tính đến lúc mở trang.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Người dùng"
          value={users.total}
          note={`${users.jobseekers} ứng viên, ${users.employers} nhà tuyển dụng`}
        />
        <StatTile label="Tin đang hiện" value={jobs.open} note={`trên tổng ${jobs.total} tin`} />
        <StatTile label="Đơn ứng tuyển" value={applications.total} note={`${applications.pending} đơn chưa được xem`} />
        <StatTile label="Công ty" value={companies.total} note={`${companies.featured} công ty nổi bật`} />
      </div>

      {(users.locked > 0 || overdue > 0) && (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {users.locked > 0 && (
            <li>
              <Link href="/admin/users?status=locked" className="font-semibold text-primary hover:underline">
                {users.locked} tài khoản đang bị khoá
              </Link>
            </li>
          )}
          {overdue > 0 && (
            <li>
              <Link href="/admin/jobs?status=active" className="font-semibold text-primary hover:underline">
                {overdue} tin &quot;Đang tuyển&quot; đã quá hạn nộp
              </Link>
              <span className="text-muted-foreground"> (không còn hiện với ứng viên)</span>
            </li>
          )}
        </ul>
      )}

      <section aria-labelledby="monthly-heading" className="mt-10">
        <h2 id="monthly-heading" className="text-2xl font-bold">
          6 tháng gần nhất
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {series.map((item) => (
            <MonthlyBars key={item.label} title={item.label} unit={item.unit} months={months} values={item.values} />
          ))}
        </div>
        <div className="mt-4">
          <MonthlyTable months={months} rows={series.map(({ label, values }) => ({ label, values }))} />
        </div>
      </section>

      <section aria-labelledby="popular-heading" className="mt-10">
        <h2 id="popular-heading" className="text-2xl font-bold">
          Nhiều tin nhất
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TopList
            title="Ngành nghề"
            items={popular.categories.map((c) => ({ name: c._id || "Chưa phân loại", count: c.count }))}
            empty="Chưa có tin nào."
          />
          <TopList
            title="Địa điểm"
            items={popular.locations.map((c) => ({ name: c._id || "Chưa ghi địa điểm", count: c.count }))}
            empty="Chưa có tin nào."
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Hồ sơ ứng viên: {profiles.total}, trong đó {profiles.withCV} hồ sơ đã có CV.
        </p>
      </section>
    </div>
  );
}
