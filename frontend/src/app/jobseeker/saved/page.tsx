import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ErrorNotice } from "@/components/error-notice";
import { JobCard } from "@/components/jobs/job-card";
import { Pagination } from "@/components/jobs/pagination";
import { Button } from "@/components/ui/button";
import { getSavedJobs } from "@/lib/api";

export const metadata: Metadata = { title: "Việc đã lưu" };

export default async function SavedJobsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  // Layout đã kiểm tra đăng nhập, nên null ở đây gần như chỉ do backend lỗi
  const result = await getSavedJobs(page);
  // Trang vượt quá số trang (ví dụ bỏ lưu hết trang cuối rồi tải lại): về trang cuối thay vì lưới rỗng
  if (result && result.totalPages > 0 && page > result.totalPages) {
    redirect(`/jobseeker/saved?page=${result.totalPages}`);
  }
  // Tin đã bị xoá (job null) không hiện
  const items = (result?.data ?? []).flatMap((item) => (item.job ? [{ id: item._id, job: item.job }] : []));

  return (
    <div>
      <h1 className="text-3xl font-bold">Việc đã lưu</h1>
      {result && result.total > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{result.total} việc, lưu gần nhất ở trên.</p>
      )}

      <div className="mt-6">
        {result === null ? (
          <ErrorNotice error={new Error("GET /api/saved-jobs thất bại")} title="Không tải được danh sách việc đã lưu" />
        ) : result.total === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Bạn chưa lưu việc nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bấm biểu tượng lưu trên tin tuyển dụng để lưu lại xem sau.
            </p>
            <Button asChild className="mt-5">
              <Link href="/jobs">Tìm việc</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Bỏ lưu ở đây: thẻ vẫn ở lại (bấm lại là lưu lại), tải lại trang thì mới biến mất */}
            <div className="grid gap-5 sm:grid-cols-2">
              {items.map((item) => (
                <JobCard key={item.id} job={item.job} save={{ mode: "jobseeker", saved: true }} />
              ))}
            </div>
            <Pagination page={page} totalPages={result.totalPages} basePath="/jobseeker/saved" />
          </div>
        )}
      </div>
    </div>
  );
}
