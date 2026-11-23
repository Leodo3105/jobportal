import Link from "next/link";
import { CalendarClock, MapPin, MessageSquareText } from "lucide-react";

import { CompanyLogo } from "@/components/jobs/company-logo";
import { WithdrawButton } from "@/components/jobseeker/withdraw-button";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VARIANT,
  INTERVIEW_TYPE_LABELS,
  WITHDRAWABLE_STATUSES,
  formatDate,
  formatDateTime,
  isJobOpen,
} from "@/lib/format";
import type { Interview, MyApplication } from "@/types/api";

export function ApplicationCard({ application }: { application: MyApplication }) {
  const { job, status } = application;
  const canWithdraw = WITHDRAWABLE_STATUSES.includes(status);
  const interview = status === "interview" ? latestInterview(application.interviews) : null;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <CompanyLogo logo={job?.company?.logo} />
        <div className="min-w-0 flex-1">
          {job ? (
            <h2 className="font-semibold leading-snug">
              <Link href={`/jobs/${job._id}`} className="hover:text-primary hover:underline">
                {job.title}
              </Link>
            </h2>
          ) : (
            <h2 className="font-semibold leading-snug text-muted-foreground">Tin tuyển dụng đã bị xoá</h2>
          )}
          {job && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span>{job.company?.name ?? "Công ty ẩn danh"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {job.location}
              </span>
            </p>
          )}
        </div>
        <Badge variant={APPLICATION_STATUS_VARIANT[status]} className="shrink-0">
          {APPLICATION_STATUS_LABELS[status]}
        </Badge>
      </div>

      {interview && (
        <div className="flex gap-3 rounded-md border border-primary/40 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {INTERVIEW_TYPE_LABELS[interview.type]} lúc {formatDateTime(interview.date)}
            </p>
            {interview.location && <p>Địa điểm: {interview.location}</p>}
            {interview.notes && <p className="mt-1">Lưu ý: {interview.notes}</p>}
          </div>
        </div>
      )}

      {application.employerFeedback && (
        <div className="flex gap-3 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            <span className="font-semibold">Phản hồi từ nhà tuyển dụng: </span>
            {application.employerFeedback}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-muted-foreground">
            Nộp ngày {formatDate(application.createdAt)}
            {job && !isJobOpen(job) && ", tin đã ngừng nhận hồ sơ"}
          </p>
          <Link
            href={`/jobseeker/applications/${application._id}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Xem chi tiết đơn
          </Link>
        </div>
        {canWithdraw && job && <WithdrawButton applicationId={application._id} jobTitle={job.title} />}
        {status === "withdrawn" && job && isJobOpen(job) && (
          <Link href={`/jobs/${job._id}/apply`} className="text-sm font-semibold text-primary hover:underline">
            Ứng tuyển lại
          </Link>
        )}
      </div>
    </article>
  );
}

// NTD có thể hẹn nhiều lần; hiện lần hẹn mới nhất
function latestInterview(interviews: Interview[]): Interview | null {
  if (interviews.length === 0) return null;
  return interviews.reduce((latest, item) => (new Date(item.date) > new Date(latest.date) ? item : latest));
}
