import type { Metadata } from "next";

import { CompanyForm, LogoUploader } from "@/components/employer/company-form";
import { getCategories, getMyCompany } from "@/lib/api";

export const metadata: Metadata = { title: "Thông tin công ty" };

export default async function CompanyPage() {
  const [company, categories] = await Promise.all([
    getMyCompany(),
    getCategories().catch(() => []), // không lấy được danh mục thì cho gõ ngành tự do
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Công ty</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {company
          ? "Thông tin này hiện ở mọi tin tuyển dụng của bạn."
          : "Tạo thông tin công ty trước, rồi mới đăng được tin tuyển dụng."}
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="company-heading" className="rounded-xl border bg-card p-6">
          <h2 id="company-heading" className="text-lg font-semibold">
            Thông tin chung
          </h2>
          <div className="mt-4">
            <CompanyForm company={company} industries={categories.map((c) => c.name)} />
          </div>
        </section>

        <section aria-labelledby="logo-heading" className="rounded-xl border bg-card p-6">
          <h2 id="logo-heading" className="text-lg font-semibold">
            Logo
          </h2>
          {company ? (
            <div className="mt-4">
              <LogoUploader logo={company.logo} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Lưu thông tin chung ở trên trước, rồi tải logo.</p>
          )}
        </section>
      </div>
    </div>
  );
}
