import Link from "next/link";

import { Button } from "@/components/ui/button";

// Hiện khi page.tsx gọi notFound(): id sai, tin đã bị xoá, hoặc tin chưa công khai
export default function JobNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="rounded-xl border border-dashed px-5 py-12 text-center">
        <p className="font-semibold">Không tìm thấy tin tuyển dụng</p>
        <p className="mt-1 text-sm text-muted-foreground">Tin có thể đã bị xoá hoặc đường dẫn bị sai.</p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/jobs">Xem các việc làm đang tuyển</Link>
        </Button>
      </div>
    </div>
  );
}
