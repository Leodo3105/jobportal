import Link from "next/link";

import { Button } from "@/components/ui/button";

export function EmployerCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <div className="flex flex-col gap-5 rounded-2xl bg-secondary px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div>
          <h2 className="text-2xl font-bold">Bạn đang tuyển người?</h2>
          <p className="mt-2 max-w-xl text-secondary-foreground">
            Tạo trang công ty, đăng tin và xem hồ sơ ứng viên ở cùng một nơi.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/register?role=employer">Đăng ký nhà tuyển dụng</Link>
        </Button>
      </div>
    </section>
  );
}
