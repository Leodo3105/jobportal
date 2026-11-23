import type { Metadata } from "next";
import Link from "next/link";

import { SubscriptionForm } from "@/components/admin/admin-actions";
import { FilterForm } from "@/components/admin/filter-form";
import { ErrorNotice } from "@/components/error-notice";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Pagination } from "@/components/jobs/pagination";
import { Badge } from "@/components/ui/badge";
import { getAdminCompanies } from "@/lib/api";
import { PLAN_LABELS, formatDate } from "@/lib/format";
import type { SubscriptionPlan } from "@/types/api";

export const metadata: Metadata = { title: "Quản lý công ty" };

interface PageProps {
  searchParams: Promise<{ search?: string; plan?: string; page?: string }>;
}

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const { search, plan, page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const filters = { search, plan };
  const result = await getAdminCompanies({ ...filters, page });

  return (
    <div>
      <h1 className="text-3xl font-bold">Công ty</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gói Premium và Doanh nghiệp: công ty và mọi tin của công ty được hiện nổi bật.
      </p>

      <div className="mt-6">
        <FilterForm
          action="/admin/companies"
          searchPlaceholder="Tên công ty"
          search={search}
          selects={[
            {
              name: "plan",
              label: "Gói dịch vụ",
              value: plan,
              options: [
                { value: "", label: "Mọi gói" },
                ...(Object.entries(PLAN_LABELS) as [SubscriptionPlan, string][]).map(([value, label]) => ({ value, label })),
              ],
            },
          ]}
        />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {result === null ? (
          <ErrorNotice error={new Error("GET /api/admin/companies thất bại")} title="Không tải được danh sách công ty" />
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Không có công ty nào khớp bộ lọc</p>
            <p className="mt-1 text-sm text-muted-foreground">Thử bỏ bớt điều kiện lọc.</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {result.data.map((company) => {
                const currentPlan = company.subscription?.type ?? "free";
                return (
                  <li key={company._id} className="flex flex-wrap items-start gap-4 p-4">
                    <CompanyLogo logo={company.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold leading-snug">
                        <Link href={`/companies/${company._id}`} className="hover:text-primary hover:underline">
                          {company.name}
                        </Link>
                        {company.featured && <Badge>Nổi bật</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {company.industry}, {company.jobCount} tin
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Chủ tài khoản: {company.user ? company.user.email : "đã bị xoá"}
                        {company.user?.isActive === false && <span className="text-destructive"> (bị khoá)</span>}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gói hiện tại: {PLAN_LABELS[currentPlan]}
                        {currentPlan !== "free" && company.subscription?.endDate && `, hết hạn ${formatDate(company.subscription.endDate)}`}
                      </p>
                    </div>
                    <SubscriptionForm
                      companyId={company._id}
                      name={company.name}
                      plan={currentPlan}
                      endDate={company.subscription?.endDate}
                    />
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} totalPages={result.totalPages} searchParams={filters} basePath="/admin/companies" />
          </>
        )}
      </div>
    </div>
  );
}
