import type { Metadata } from "next";

import { ErrorNotice } from "@/components/error-notice";
import { JobGrid } from "@/components/jobs/job-grid";
import { Pagination } from "@/components/jobs/pagination";
import { SearchForm } from "@/components/jobs/search-form";
import { getCategories, getJobViewer, getJobs } from "@/lib/api";

export const metadata: Metadata = { title: "Việc làm" };

const PAGE_SIZE = 12;

// Next.js 15: searchParams là Promise, phải await trước khi dùng
interface JobsPageProps {
  searchParams: Promise<{ keyword?: string; location?: string; category?: string; page?: string }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { keyword, location, category, page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1); // "abc" hoặc thiếu => trang 1
  const filters = { keyword, location, category };

  const [jobsResult, categoriesResult, viewerResult] = await Promise.allSettled([
    getJobs({ ...filters, page, limit: PAGE_SIZE }),
    getCategories(),
    getJobViewer(), // ai đang xem, để hiện nút "Lưu tin" trên thẻ
  ]);

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const viewer = viewerResult.status === "fulfilled" ? viewerResult.value : null;
  const isFiltering = Boolean(keyword || location || category);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold">{category ? `Việc làm ngành ${category}` : "Việc làm"}</h1>

      <div className="mt-6">
        <SearchForm categories={categories} defaultValues={filters} />
      </div>

      <div className="mt-8">
        {jobsResult.status === "rejected" ? (
          <ErrorNotice error={jobsResult.reason} />
        ) : (
          <div className="flex flex-col gap-8">
            <JobGrid
              jobs={jobsResult.value.data}
              viewer={viewer}
              emptyTitle={isFiltering ? "Không có việc nào khớp bộ lọc" : "Chưa có việc làm nào"}
              emptyText={
                isFiltering
                  ? "Thử bỏ bớt từ khóa, đổi địa điểm hoặc chọn ngành khác."
                  : "Các tin tuyển dụng mới sẽ hiện ở đây."
              }
            />
            <Pagination page={page} totalPages={jobsResult.value.totalPages} searchParams={filters} />
          </div>
        )}
      </div>
    </div>
  );
}
