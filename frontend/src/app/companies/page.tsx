import type { Metadata } from "next";
import { Search } from "lucide-react";

import { CompanyCard } from "@/components/companies/company-card";
import { ErrorNotice } from "@/components/error-notice";
import { Pagination } from "@/components/jobs/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getCategories, getCompanies } from "@/lib/api";

export const metadata: Metadata = { title: "Công ty" };

const PAGE_SIZE = 12;

interface CompaniesPageProps {
  searchParams: Promise<{ search?: string; industry?: string; page?: string }>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const { search, industry, page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const filters = { search, industry };

  const [companiesResult, categoriesResult] = await Promise.allSettled([
    getCompanies({ ...filters, page, limit: PAGE_SIZE }),
    getCategories(),
  ]);
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const isFiltering = Boolean(search || industry);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold">Công ty</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tìm hiểu nơi bạn muốn làm việc trước khi ứng tuyển.</p>

      {/* Form GET thuần: gửi đi là đổi URL (?search=...&industry=...), Server Component tự lọc, không cần JavaScript */}
      <form
        action="/companies"
        method="GET"
        role="search"
        className="mt-6 grid gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid-cols-[2fr_1fr_auto]"
      >
        <label className="relative">
          <span className="sr-only">Tên công ty</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input name="search" placeholder="Tên công ty" defaultValue={search} className="h-11 pl-9" />
        </label>
        <label>
          <span className="sr-only">Ngành nghề</span>
          <NativeSelect name="industry" defaultValue={industry ?? ""}>
            <option value="">Tất cả ngành nghề</option>
            {categories.map((category) => (
              <option key={category._id} value={category.name}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" size="lg" className="h-11">
          Tìm công ty
        </Button>
      </form>

      <div className="mt-8">
        {companiesResult.status === "rejected" ? (
          <ErrorNotice error={companiesResult.reason} title="Không tải được danh sách công ty" />
        ) : companiesResult.value.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">{isFiltering ? "Không có công ty nào khớp bộ lọc" : "Chưa có công ty nào"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFiltering ? "Thử tên ngắn hơn hoặc chọn ngành khác." : "Các công ty đăng tin tuyển dụng sẽ hiện ở đây."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {isFiltering && (
              <p className="text-sm text-muted-foreground">Tìm thấy {companiesResult.value.total} công ty.</p>
            )}
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {companiesResult.value.data.map((company) => (
                <li key={company._id}>
                  <CompanyCard company={company} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={companiesResult.value.totalPages} searchParams={filters} basePath="/companies" />
          </div>
        )}
      </div>
    </div>
  );
}
