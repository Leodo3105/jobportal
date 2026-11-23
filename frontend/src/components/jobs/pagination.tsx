import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  // Các điều kiện lọc hiện tại, để chuyển trang không làm mất bộ lọc
  searchParams?: Record<string, string | undefined>;
  basePath?: string; // trang chứa danh sách, mặc định /jobs
}

export function Pagination({ page, totalPages, searchParams = {}, basePath = "/jobs" }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Tạo link tới trang số `target`, giữ nguyên keyword, location, category
  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page - 1)}>Trang trước</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Trang trước
        </Button>
      )}

      <span className="text-sm text-muted-foreground">
        Trang {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page + 1)}>Trang sau</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Trang sau
        </Button>
      )}
    </nav>
  );
}
