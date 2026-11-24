import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, ChevronRight, ExternalLink, MapPin, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ErrorNotice } from "@/components/error-notice";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { JobCard } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { getCompany, getJobViewer, getJobs, saveStateFor } from "@/lib/api";
import { companySizeLabel } from "@/lib/format";
import type { PublicCompany } from "@/types/api";

// Link do NTD nhập: backend đã chỉ nhận http(s), khi hiển thị vẫn kiểm tra lại (dữ liệu cũ)
const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : null);

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const company = await getCompany(id); // cache(): không gọi backend lần hai
    if (!company) return { title: "Không tìm thấy công ty" };
    return { title: company.name, description: company.description.slice(0, 160) };
  } catch {
    return { title: "Công ty" };
  }
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params;

  let company: PublicCompany | null;
  try {
    company = await getCompany(id);
  } catch (error) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10">
        <ErrorNotice error={error} title="Không tải được thông tin công ty" />
      </div>
    );
  }
  if (!company) notFound();

  // Tối đa 50 tin (giới hạn của API); công ty nhiều hơn thì cần phân trang
  // Gọi cùng lúc; viewer: ai đang xem, để hiện nút "Lưu tin" trên thẻ
  const [jobs, viewer] = await Promise.all([getJobs({ company: id, limit: 50 }).catch(() => null), getJobViewer()]);
  const links = [
    { label: "Website", url: safeUrl(company.website) },
    { label: "Facebook", url: safeUrl(company.socialMedia?.facebook) },
    { label: "LinkedIn", url: safeUrl(company.socialMedia?.linkedin) },
  ].filter((link) => link.url);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/companies" className="hover:text-foreground hover:underline">
              Công ty
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <Link href={`/companies?industry=${encodeURIComponent(company.industry)}`} className="hover:text-foreground hover:underline">
              {company.industry}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="mt-4 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <CompanyLogo logo={company.logo} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold leading-tight">{company.name}</h1>
            {company.featured && <Badge className="mt-2">Nổi bật</Badge>}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-4">
          <Fact icon={Building2} label="Ngành nghề" value={company.industry} />
          <Fact icon={Users} label="Quy mô" value={companySizeLabel(company.companySize)} />
          <Fact icon={MapPin} label="Địa chỉ" value={company.location} />
          {company.foundedYear && <Fact icon={CalendarDays} label="Thành lập" value={String(company.foundedYear)} />}
        </dl>

        {links.length > 0 && (
          <p className="mt-6 flex flex-wrap gap-4 text-sm">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                {link.label}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ))}
          </p>
        )}
      </header>

      <section aria-labelledby="about-heading" className="mt-6 rounded-xl border bg-card p-6">
        <h2 id="about-heading" className="text-lg font-semibold">
          Giới thiệu
        </h2>
        {/* Nội dung NTD nhập: whitespace-pre-line giữ xuống dòng, React tự escape nên không bị XSS */}
        <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed">{company.description}</p>
      </section>

      <section aria-labelledby="jobs-heading" className="mt-12">
        <h2 id="jobs-heading" className="text-2xl font-bold">
          Việc đang tuyển{company.openJobCount > 0 && ` (${company.openJobCount})`}
        </h2>
        <div className="mt-6">
          {jobs === null ? (
            <ErrorNotice error={new Error(`GET /api/jobs?company=${id} thất bại`)} title="Không tải được việc làm của công ty" />
          ) : jobs.data.length === 0 ? (
            <div className="rounded-xl border border-dashed px-5 py-12 text-center">
              <p className="font-semibold">Công ty chưa có việc đang tuyển</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Xem{" "}
                <Link href="/jobs" className="font-semibold text-primary hover:underline">
                  các việc làm khác
                </Link>{" "}
                trong lúc chờ.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.data.map((job) => (
                <JobCard key={job._id} job={job} save={saveStateFor(viewer, job._id)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold break-words">{value}</dd>
    </div>
  );
}
