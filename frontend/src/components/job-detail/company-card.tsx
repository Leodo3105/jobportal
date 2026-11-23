import Link from "next/link";
import { Building2, ExternalLink, MapPin, Users } from "lucide-react";

import { CompanyLogo } from "@/components/jobs/company-logo";
import { companySizeLabel } from "@/lib/format";
import type { CompanyDetail } from "@/types/api";

// Chỉ hiện link khi website bắt đầu bằng http:// hoặc https://.
// Chặn kiểu "javascript:alert(1)" do người dùng nhập vào hồ sơ công ty.
function safeWebsite(url?: string): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

export function CompanyCard({ company }: { company: CompanyDetail | null }) {
  if (!company) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="font-semibold">Công ty ẩn danh</p>
        <p className="mt-1 text-sm text-muted-foreground">Thông tin công ty không còn trên hệ thống.</p>
      </div>
    );
  }

  const website = safeWebsite(company.website);

  return (
    <section aria-labelledby="company-heading" className="rounded-xl border bg-card p-5">
      <h2 id="company-heading" className="text-lg font-semibold">
        Về công ty
      </h2>

      <div className="mt-4 flex items-center gap-3">
        <CompanyLogo logo={company.logo} />
        <p className="min-w-0 font-semibold leading-snug">
          <Link href={`/companies/${company._id}`} className="hover:text-primary hover:underline">
            {company.name}
          </Link>
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
        {company.industry && (
          <li className="flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {company.industry}
          </li>
        )}
        <li className="flex items-start gap-2">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {companySizeLabel(company.companySize)}
        </li>
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {company.location}
        </li>
      </ul>

      {company.description && (
        <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm">{company.description}</p>
      )}

      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Trang web công ty
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
