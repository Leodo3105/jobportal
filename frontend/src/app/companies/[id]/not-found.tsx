import Link from "next/link";

import { Button } from "@/components/ui/button";

// Hiện khi page.tsx gọi notFound(): id sai hoặc công ty không còn
export default function CompanyNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="rounded-xl border border-dashed px-5 py-12 text-center">
        <p className="font-semibold">Không tìm thấy công ty</p>
        <p className="mt-1 text-sm text-muted-foreground">Công ty có thể đã ngừng hoạt động trên trang hoặc đường dẫn bị sai.</p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/companies">Xem các công ty khác</Link>
        </Button>
      </div>
    </div>
  );
}
