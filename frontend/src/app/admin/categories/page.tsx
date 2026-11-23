import type { Metadata } from "next";
import Link from "next/link";

import { CategoryCreateForm, CategoryRow } from "@/components/admin/category-manager";
import { ErrorNotice } from "@/components/error-notice";
import { getAdminCategories } from "@/lib/api";
import { CATEGORY_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/api";

export const metadata: Metadata = { title: "Quản lý danh mục" };

const TYPES = Object.keys(CATEGORY_TYPE_LABELS) as Category["type"][];

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const { type: typeParam } = await searchParams;
  const type = TYPES.find((t) => t === typeParam) ?? "industry";
  const categories = await getAdminCategories(type);

  return (
    <div>
      <h1 className="text-3xl font-bold">Danh mục</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ngành nghề hiện ở trang chủ, bộ lọc việc làm và form đăng tin. Danh mục đang ẩn không hiện với người dùng.
      </p>

      {/* Tab theo loại bằng link (?type=), giống tab lọc đơn ở khu NTD */}
      <nav aria-label="Loại danh mục" className="-mx-5 mt-6 overflow-x-auto px-5">
        <ul className="flex gap-1 border-b">
          {TYPES.map((t) => {
            const active = t === type;
            return (
              <li key={t}>
                <Link
                  href={`/admin/categories?type=${t}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {CATEGORY_TYPE_LABELS[t]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-4">
        {/* key: đổi tab thì form tạo mới được làm lại từ đầu */}
        <div className="flex">
          <CategoryCreateForm key={type} type={type} typeLabel={CATEGORY_TYPE_LABELS[type]} />
        </div>

        {categories === null ? (
          <ErrorNotice error={new Error("GET /api/admin/categories thất bại")} title="Không tải được danh mục" />
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Chưa có danh mục loại này</p>
            <p className="mt-1 text-sm text-muted-foreground">Bấm &quot;Thêm&quot; ở trên để tạo danh mục đầu tiên.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {categories.map((category) => (
              <li key={category._id}>
                <CategoryRow category={category} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
