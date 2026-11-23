import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { JobForm } from "@/components/employer/job-form";
import { Button } from "@/components/ui/button";
import { getCategories, getMyCompany } from "@/lib/api";

export const metadata: Metadata = { title: "Đăng tin tuyển dụng" };

export default async function NewJobPage() {
  const [company, categories] = await Promise.all([getMyCompany(), getCategories().catch(() => [])]);

  return (
    <div className="max-w-3xl">
      <Link
        href="/employer/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Tất cả tin tuyển dụng
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Đăng tin tuyển dụng</h1>

      <div className="mt-6">
        {/* Backend bắt buộc có công ty trước khi đăng tin */}
        {company ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Tin được đăng dưới tên <span className="font-semibold text-foreground">{company.name}</span> và hiện ngay với ứng viên. Muốn
              chưa công khai thì sau khi đăng, chuyển tin sang &quot;Bản nháp&quot; ở danh sách tin.
            </p>
            <JobForm categories={categories.map((c) => c.name)} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Bạn cần tạo thông tin công ty trước</p>
            <p className="mt-1 text-sm text-muted-foreground">Ứng viên sẽ thấy tên, logo và giới thiệu công ty ở mỗi tin.</p>
            <Button asChild className="mt-5">
              <Link href="/employer/company">Tạo thông tin công ty</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
