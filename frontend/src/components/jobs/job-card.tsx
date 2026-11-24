import Link from "next/link";
import { Clock, MapPin } from "lucide-react";

import { CompanyLogo } from "@/components/jobs/company-logo";
import { SaveJobButton } from "@/components/jobs/save-job-button";
import { Badge } from "@/components/ui/badge";
import { EXPERIENCE_LABELS, JOB_TYPE_LABELS, formatSalary, isJobOpen, timeAgo } from "@/lib/format";
import type { JobCardData } from "@/types/api";

const MAX_SKILLS = 3; // chỉ hiện 3 kỹ năng đầu cho thẻ gọn

interface JobCardProps {
  job: JobCardData;
  // Có thì hiện nút "Lưu tin" (khách: bấm đi đăng nhập). Không truyền (NTD/admin) thì không có nút.
  save?: { mode: "guest" | "jobseeker"; saved: boolean };
}

export function JobCard({ job, save }: JobCardProps) {
  const extraSkills = job.skills.length - MAX_SKILLS;
  // Danh sách công khai chỉ có tin đang mở; chỉ danh sách đã lưu mới có tin đóng (kèm status)
  const closed = job.status !== undefined && !isJobOpen({ status: job.status, applicationDeadline: job.applicationDeadline });

  return (
    <article className="relative flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-center gap-3">
        <CompanyLogo logo={job.company?.logo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{job.company?.name ?? "Công ty ẩn danh"}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            <span className="truncate">{job.location}</span>
          </p>
        </div>
        {closed ? <Badge variant="outline">Tin đã đóng</Badge> : job.featured && <Badge>Nổi bật</Badge>}
        {save && (
          <SaveJobButton jobId={job._id} jobTitle={job.title} mode={save.mode} initialSaved={save.saved} variant="icon" />
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold leading-snug">
          <Link
            href={`/jobs/${job._id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {job.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {JOB_TYPE_LABELS[job.jobType]}, {EXPERIENCE_LABELS[job.experienceLevel]}
        </p>
      </div>

      {job.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Kỹ năng">
          {job.skills.slice(0, MAX_SKILLS).map((skill) => (
            <li key={skill}>
              <Badge variant="secondary">{skill}</Badge>
            </li>
          ))}
          {extraSkills > 0 && (
            <li>
              <Badge variant="outline">+{extraSkills}</Badge>
            </li>
          )}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
        <p className="font-semibold text-primary">{formatSalary(job)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {timeAgo(job.createdAt)}
        </p>
      </div>
    </article>
  );
}
