import Link from "next/link";
import { Briefcase, MapPin } from "lucide-react";

import { CompanyLogo } from "@/components/jobs/company-logo";
import { Badge } from "@/components/ui/badge";
import { companySizeLabel } from "@/lib/format";
import type { PublicCompany } from "@/types/api";

// Thẻ công ty trong lưới /companies. Cả thẻ bấm được nhưng chỉ có một link (giống job-card.tsx).
export function CompanyCard({ company }: { company: PublicCompany }) {
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-start gap-3">
        <CompanyLogo logo={company.logo} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">
            <Link
              href={`/companies/${company._id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            >
              {company.name}
            </Link>
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{company.industry}</p>
        </div>
        {company.featured && <Badge>Nổi bật</Badge>}
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">{company.description}</p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-4 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{company.location}</span>
        </span>
        <span className="text-muted-foreground">{companySizeLabel(company.companySize)}</span>
      </div>

      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Briefcase className="size-4" aria-hidden="true" />
        {company.openJobCount > 0 ? `${company.openJobCount} việc đang tuyển` : "Chưa có việc đang tuyển"}
      </p>
    </article>
  );
}
