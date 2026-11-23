import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, ChevronRight, GraduationCap, MapPin, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ErrorNotice } from "@/components/error-notice";
import { FormAlert } from "@/components/form-alert";
import { ApplyPanel } from "@/components/job-detail/apply-panel";
import { CompanyCard } from "@/components/job-detail/company-card";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { JobCard } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getJob, getMyApplicationForJob, getSimilarJobs } from "@/lib/api";
import { EDUCATION_LABELS, EXPERIENCE_LABELS, JOB_TYPE_LABELS, isJobOpen } from "@/lib/format";
import type { JobDetail } from "@/types/api";

// Next.js 15: params là Promise, phải await trước khi dùng
interface JobPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applied?: string }>; // ?applied=1 sau khi nộp hồ sơ thành công
}

const MAX_SIMILAR = 3; // vừa một hàng của lưới 3 cột

// Tiêu đề tab trình duyệt. getJob đã bọc cache() nên không gọi backend lần thứ hai.
export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const job = await getJob(id);
    if (!job) return { title: "Không tìm thấy tin tuyển dụng" };
    return {
      title: job.company ? `${job.title} tại ${job.company.name}` : job.title,
      description: job.description.slice(0, 160),
    };
  } catch {
    return { title: "Việc làm" }; // backend lỗi: phần thân trang sẽ hiện thông báo
  }
}

export default async function JobPage({ params, searchParams }: JobPageProps) {
  const { id } = await params;
  const { applied } = await searchParams;

  let job: JobDetail | null;
  try {
    job = await getJob(id);
  } catch (error) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10">
        <ErrorNotice error={error} title="Không tải được tin tuyển dụng" />
      </div>
    );
  }

  if (!job) notFound(); // id sai định dạng, không có tin, hoặc tin nháp

  // Hai việc này không phụ thuộc nhau nên gọi song song
  const [user, similarJobs] = await Promise.all([getCurrentUser(), getSimilarJobs(id)]);
  // Chỉ ứng viên mới có đơn ứng tuyển
  const application = user?.role === "jobseeker" ? await getMyApplicationForJob(id) : null;
  const open = isJobOpen(job);
  // Chỉ hiện hộp thành công khi thật sự có đơn, tránh ai đó tự gõ ?applied=1
  const justApplied = applied === "1" && application !== null && application.status !== "withdrawn";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/jobs" className="hover:text-foreground hover:underline">
              Việc làm
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <Link href={`/jobs?category=${encodeURIComponent(job.category)}`} className="hover:text-foreground hover:underline">
              {job.category}
            </Link>
          </li>
        </ol>
      </nav>

      {/*
        Lưới 2 cột ở màn hình lớn. Thứ tự trong HTML: đầu tin → khối ứng tuyển → nội dung,
        để trên điện thoại nút Ứng tuyển nằm ngay dưới phần đầu tin.
        Ở màn hình lớn, aside được đặt sang cột 2 và kéo dài 2 hàng.
      */}
      {justApplied && (
        <div className="mt-4">
          <FormAlert variant="success">
            Đã nộp hồ sơ. Nhà tuyển dụng sẽ liên hệ với bạn nếu hồ sơ phù hợp.
          </FormAlert>
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <header className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-4">
            <CompanyLogo logo={job.company?.logo} size="lg" />
            <p className="min-w-0 font-semibold">{job.company?.name ?? "Công ty ẩn danh"}</p>
          </div>

          <h1 className="mt-5 text-3xl font-bold leading-tight">{job.title}</h1>

          {(job.featured || !open) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!open && <Badge variant="outline">Tin đã đóng</Badge>}
              {job.featured && open && <Badge>Nổi bật</Badge>}
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-6 sm:grid-cols-4">
            <Fact icon={MapPin} label="Địa điểm" value={job.location} />
            <Fact icon={Briefcase} label="Hình thức" value={JOB_TYPE_LABELS[job.jobType]} />
            <Fact icon={TrendingUp} label="Kinh nghiệm" value={EXPERIENCE_LABELS[job.experienceLevel]} />
            <Fact icon={GraduationCap} label="Học vấn" value={EDUCATION_LABELS[job.educationLevel]} />
          </dl>

          {job.skills.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Kỹ năng">
              {job.skills.map((skill) => (
                <li key={skill}>
                  <Badge variant="secondary">{skill}</Badge>
                </li>
              ))}
            </ul>
          )}
        </header>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <ApplyPanel job={job} user={user} application={application} />
          <CompanyCard company={job.company} />
        </aside>

        <article className="divide-y rounded-xl border bg-card px-6">
          <JobSection title="Mô tả công việc" text={job.description} />
          <JobSection title="Yêu cầu ứng viên" text={job.requirements} />
          <JobSection title="Quyền lợi" text={job.benefits} />
        </article>
      </div>

      {similarJobs.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-12">
          <h2 id="similar-heading" className="text-2xl font-bold">
            Việc làm tương tự
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similarJobs.slice(0, MAX_SIMILAR).map((similar) => (
              <JobCard key={similar._id} job={similar} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

// Nội dung do NTD nhập là chuỗi có xuống dòng (\n).
// whitespace-pre-line giữ xuống dòng; React tự escape chữ nên không bị XSS (không dùng dangerouslySetInnerHTML).
function JobSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="py-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed">{text}</p>
    </section>
  );
}
