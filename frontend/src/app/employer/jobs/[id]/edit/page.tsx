import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { JobForm } from "@/components/employer/job-form";
import { ErrorNotice } from "@/components/error-notice";
import { getCategories, getMyJob } from "@/lib/api";

export const metadata: Metadata = { title: "Sửa tin tuyển dụng" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Dùng API tin của NTD, không gọi GET /api/jobs/:id vì API đó tăng lượt xem và trả 404 với tin nháp
  const [job, categories] = await Promise.all([getMyJob(id), getCategories().catch(() => [])]);
  if (job === "notFound") notFound(); // không phải tin của mình, không tồn tại, hoặc id sai

  return (
    <div className="max-w-3xl">
      <Link
        href="/employer/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Tất cả tin tuyển dụng
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Sửa tin tuyển dụng</h1>

      <div className="mt-6">
        {job ? (
          <JobForm job={job} categories={categories.map((c) => c.name)} />
        ) : (
          <ErrorNotice error={new Error(`GET /api/jobs/employer/myjobs/${id} thất bại`)} title="Không tải được tin tuyển dụng" />
        )}
      </div>
    </div>
  );
}
