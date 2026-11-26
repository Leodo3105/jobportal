import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorNotice } from "@/components/error-notice";
import { Pagination } from "@/components/jobs/pagination";
import { ApplicationCard } from "@/components/jobseeker/application-card";
import { Button } from "@/components/ui/button";
import { getMyApplications } from "@/lib/api";

export const metadata: Metadata = { title: "Đơn ứng tuyển" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  // Layout đã kiểm tra đăng nhập, nên null ở đây gần như chỉ do backend lỗi
  const result = await getMyApplications(page);
  // Trang vượt quá số trang (sửa tay URL, link cũ): về trang cuối thay vì danh sách rỗng
  if (result && result.totalPages > 0 && page > result.totalPages) {
    redirect(`/jobseeker/applications?page=${result.totalPages}`);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Đơn ứng tuyển</h1>
      {result && result.total > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{result.total} đơn, mới nhất ở trên.</p>
      )}

      <div className="mt-6">
        {result === null ? (
          <ErrorNotice
            error={new Error("GET /api/applications/user/myapplications thất bại")}
            title="Không tải được danh sách đơn ứng tuyển"
          />
        ) : result.total === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Bạn chưa ứng tuyển việc nào</p>
            <p className="mt-1 text-sm text-muted-foreground">Tìm việc phù hợp và nộp hồ sơ, đơn sẽ hiện ở đây.</p>
            <Button asChild className="mt-5">
              <Link href="/jobs">Tìm việc</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <ul className="flex flex-col gap-4">
              {result.data.map((application) => (
                <li key={application._id}>
                  <ApplicationCard application={application} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={result.totalPages} basePath="/jobseeker/applications" />
          </div>
        )}
      </div>
    </div>
  );
}
