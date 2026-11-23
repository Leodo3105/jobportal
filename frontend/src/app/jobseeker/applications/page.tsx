import type { Metadata } from "next";
import Link from "next/link";

import { ErrorNotice } from "@/components/error-notice";
import { ApplicationCard } from "@/components/jobseeker/application-card";
import { Button } from "@/components/ui/button";
import { getMyApplications } from "@/lib/api";

export const metadata: Metadata = { title: "Đơn ứng tuyển" };

export default async function ApplicationsPage() {
  // Layout đã kiểm tra đăng nhập, nên null ở đây gần như chỉ do backend lỗi
  const applications = await getMyApplications();

  return (
    <div>
      <h1 className="text-3xl font-bold">Đơn ứng tuyển</h1>
      {applications && applications.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{applications.length} đơn, mới nhất ở trên.</p>
      )}

      <div className="mt-6">
        {applications === null ? (
          <ErrorNotice
            error={new Error("GET /api/applications/user/myapplications thất bại")}
            title="Không tải được danh sách đơn ứng tuyển"
          />
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Bạn chưa ứng tuyển việc nào</p>
            <p className="mt-1 text-sm text-muted-foreground">Tìm việc phù hợp và nộp hồ sơ, đơn sẽ hiện ở đây.</p>
            <Button asChild className="mt-5">
              <Link href="/jobs">Tìm việc</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {applications.map((application) => (
              <li key={application._id}>
                <ApplicationCard application={application} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
