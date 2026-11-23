import Link from "next/link";

import { SearchForm } from "@/components/jobs/search-form";
import type { Category } from "@/types/api";

const QUICK_LINKS = 5; // số ngành hiện dưới ô tìm kiếm

export function Hero({ categories }: { categories: Category[] }) {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <h1 className="max-w-3xl text-4xl leading-[1.15] font-bold sm:text-5xl">Tìm việc phù hợp, ứng tuyển chỉ với một CV</h1>
        <p className="mt-5 max-w-2xl text-lg text-white/75">
          Xem tin tuyển dụng mới mỗi ngày, nộp hồ sơ trực tuyến và theo dõi trạng thái đơn ngay trên JobPortal.
        </p>

        {/* Form nằm trên nền tối nhưng dùng nền trắng, nên đổi lại màu chữ cho đúng */}
        <div className="mt-8 max-w-4xl text-foreground">
          <SearchForm categories={categories} />
        </div>

        {categories.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-white/60">Tìm nhanh:</span>
            {categories.slice(0, QUICK_LINKS).map((category) => (
              <Link
                key={category._id}
                // encodeURIComponent: đổi dấu cách, chữ có dấu thành dạng an toàn trên URL
                href={`/jobs?category=${encodeURIComponent(category.name)}`}
                className="underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
