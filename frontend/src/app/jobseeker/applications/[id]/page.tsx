import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, Download, MapPin } from "lucide-react";

import { CompanyLogo } from "@/components/jobs/company-logo";
import { WithdrawButton } from "@/components/jobseeker/withdraw-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyApplication } from "@/lib/api";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VARIANT,
  INTERVIEW_TYPE_LABELS,
  WITHDRAWABLE_STATUSES,
  formatDate,
  formatDateTime,
  isJobOpen,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types/api";

export const metadata: Metadata = { title: "Chi tiết đơn ứng tuyển" };

// Giải thích từng trạng thái bằng lời cho ứng viên: bây giờ ra sao, nên làm gì tiếp
const STATUS_EXPLAIN: Record<ApplicationStatus, string> = {
  pending: "Nhà tuyển dụng chưa mở hồ sơ của bạn. Bạn sẽ nhận thông báo khi có thay đổi.",
  viewed: "Nhà tuyển dụng đã xem hồ sơ và đang cân nhắc.",
  interview: "Bạn được mời phỏng vấn. Xem lịch bên dưới và chuẩn bị trước nhé.",
  accepted: "Chúc mừng! Nhà tuyển dụng đã chọn bạn. Họ sẽ liên hệ để trao đổi bước tiếp theo.",
  rejected: "Lần này hồ sơ chưa phù hợp. Bạn vẫn có thể ứng tuyển các vị trí khác.",
  withdrawn: "Bạn đã rút đơn này. Nhà tuyển dụng không xử lý đơn đã rút.",
};

interface ApplicationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationPage({ params }: ApplicationPageProps) {
  const { id } = await params;
  // Backend trả 403 nếu đơn của người khác, 400/404 nếu id sai: đều coi là không tìm thấy,
  // để không tiết lộ đơn đó có tồn tại hay không
  const application = await getMyApplication(id);
  if (!application) notFound();

  const { job, status } = application;
  const now = new Date();
  // Lịch phỏng vấn theo thứ tự thời gian; lịch đã qua hiện mờ đi
  const interviews = [...application.interviews].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-3xl">
      <Link
        href="/jobseeker/applications"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Tất cả đơn ứng tuyển
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <CompanyLogo logo={job?.company?.logo} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight">{job?.title ?? "Tin tuyển dụng đã bị xoá"}</h1>
          {job && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span>{job.company?.name ?? "Công ty ẩn danh"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {job.location}
              </span>
              <Link href={`/jobs/${job._id}`} className="font-semibold text-primary hover:underline">
                Xem tin tuyển dụng
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <section aria-labelledby="status-heading" className="rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="status-heading" className="text-lg font-semibold">
              Trạng thái
            </h2>
            <Badge variant={APPLICATION_STATUS_VARIANT[status]}>
              {APPLICATION_STATUS_LABELS[status]}
            </Badge>
          </div>
          <p className="mt-2">{STATUS_EXPLAIN[status]}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nộp ngày {formatDate(application.createdAt)}, cập nhật lần cuối {formatDate(application.updatedAt)}.
          </p>

          {application.employerFeedback && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-semibold">Phản hồi từ nhà tuyển dụng</p>
              <p className="mt-1 whitespace-pre-line">{application.employerFeedback}</p>
            </div>
          )}

          {job && WITHDRAWABLE_STATUSES.includes(status) && (
            <div className="mt-4 border-t pt-4">
              <WithdrawButton applicationId={application._id} jobTitle={job.title} />
            </div>
          )}
          {job && status === "withdrawn" && isJobOpen(job) && (
            <div className="mt-4 border-t pt-4">
              <Button asChild>
                <Link href={`/jobs/${job._id}/apply`}>Ứng tuyển lại</Link>
              </Button>
            </div>
          )}
        </section>

        {interviews.length > 0 && (
          <section aria-labelledby="interviews-heading" className="rounded-xl border bg-card p-6">
            <h2 id="interviews-heading" className="text-lg font-semibold">
              Lịch phỏng vấn
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {interviews.map((interview) => {
                const past = new Date(interview.date) < now;
                return (
                  <li
                    key={interview._id}
                    className={cn(
                      "flex gap-3 rounded-md border px-4 py-3 text-sm",
                      past ? "text-muted-foreground" : "border-primary/40 bg-secondary text-secondary-foreground"
                    )}
                  >
                    <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">
                        {INTERVIEW_TYPE_LABELS[interview.type]} lúc {formatDateTime(interview.date)}
                        {past && " (đã qua)"}
                      </p>
                      {interview.location && <p>Địa điểm: {interview.location}</p>}
                      {interview.notes && <p className="mt-1 whitespace-pre-line">Lưu ý: {interview.notes}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="sent-heading" className="rounded-xl border bg-card p-6">
          <h2 id="sent-heading" className="text-lg font-semibold">
            Hồ sơ đã gửi
          </h2>

          {application.attachedCV && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              {/* Tải qua API có kiểm tra quyền, không dùng /uploads/cv (đã bị chặn) */}
              <a href={`/api/applications/${application._id}/cv`}>
                <Download aria-hidden="true" />
                Tải CV đã gửi
              </a>
            </Button>
          )}

          <p className="mt-4 text-sm font-semibold">Thư giới thiệu</p>
          {application.coverLetter ? (
            <p className="mt-1 max-w-prose whitespace-pre-line">{application.coverLetter}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Bạn không gửi kèm thư giới thiệu.</p>
          )}
        </section>
      </div>
    </div>
  );
}
