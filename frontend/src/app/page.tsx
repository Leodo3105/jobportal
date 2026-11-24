import Link from "next/link";

import { ErrorNotice } from "@/components/error-notice";
import { CategoryGrid } from "@/components/home/category-grid";
import { EmployerCta } from "@/components/home/employer-cta";
import { Hero } from "@/components/home/hero";
import { JobGrid } from "@/components/jobs/job-grid";
import { getCategories, getJobViewer, getJobs } from "@/lib/api";

// Đây là Server Component (mặc định trong App Router): hàm async chạy trên server,
// gọi API xong mới gửi HTML hoàn chỉnh về trình duyệt.
export default async function HomePage() {
  // Gọi cùng lúc. allSettled: một cái lỗi thì cái kia vẫn dùng được.
  const [jobsResult, categoriesResult, viewerResult] = await Promise.allSettled([
    getJobs({ limit: 6 }),
    getCategories(),
    getJobViewer(), // ai đang xem, để hiện nút "Lưu tin" trên thẻ
  ]);

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const viewer = viewerResult.status === "fulfilled" ? viewerResult.value : null;

  return (
    <>
      <Hero categories={categories} />

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16">
          <h2 className="text-2xl font-bold">Tìm theo ngành nghề</h2>
          <div className="mt-6">
            <CategoryGrid categories={categories} />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">Việc làm mới</h2>
          <Link href="/jobs" className="text-sm font-semibold text-primary hover:underline">
            Xem tất cả việc làm
          </Link>
        </div>
        <div className="mt-6">
          {jobsResult.status === "fulfilled" ? (
            <JobGrid jobs={jobsResult.value.data} viewer={viewer} />
          ) : (
            <ErrorNotice error={jobsResult.reason} />
          )}
        </div>
      </section>

      <EmployerCta />
    </>
  );
}
