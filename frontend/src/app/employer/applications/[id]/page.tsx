import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, Download, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

import { InterviewForm, NotesPanel, StatusForm } from "@/components/employer/application-actions";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { getEmployerApplication } from "@/lib/api";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_VARIANT,
  INTERVIEW_TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatPeriod,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chi tiết đơn ứng tuyển" };

// Link do ứng viên nhập: backend đã chỉ nhận http(s), nhưng khi hiển thị vẫn kiểm tra lại
// (dữ liệu cũ có thể được lưu trước khi backend kiểm tra).
const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : null);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployerApplicationPage({ params }: PageProps) {
  const { id } = await params;
  // Lần đầu NTD mở đơn "pending", backend đổi thành "viewed" và báo cho ứng viên
  const application = await getEmployerApplication(id);
  if (!application) notFound();

  const { user, profile, job, status } = application;
  const withdrawn = status === "withdrawn";
  const now = new Date();
  const interviews = [...application.interviews].sort((a, b) => a.date.localeCompare(b.date));
  const links = [
    { label: "Website", url: safeUrl(profile?.website) },
    { label: "LinkedIn", url: safeUrl(profile?.socialMedia?.linkedin) },
    { label: "GitHub", url: safeUrl(profile?.socialMedia?.github) },
  ].filter((link) => link.url);

  return (
    <div>
      <Link
        href={job ? `/employer/jobs/${job._id}` : "/employer/jobs"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {job ? `Đơn của tin "${job.title}"` : "Tất cả tin tuyển dụng"}
      </Link>

      {/* Phần đầu: ứng viên + trạng thái */}
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <UserAvatar avatar={user?.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold leading-tight">{user?.name ?? "Tài khoản đã bị xoá"}</h1>
          {profile?.title && <p className="mt-1 font-medium">{profile.title}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {user?.email && (
              <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                <Mail className="size-3.5" aria-hidden="true" />
                {user.email}
              </a>
            )}
            {user?.phone && (
              <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                <Phone className="size-3.5" aria-hidden="true" />
                {user.phone}
              </a>
            )}
            {profile?.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {profile.location}
              </span>
            )}
          </p>
        </div>
        <Badge variant={APPLICATION_STATUS_VARIANT[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Cột trái: hồ sơ ứng viên */}
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="sent-heading" className="rounded-xl border bg-card p-6">
            <h2 id="sent-heading" className="text-lg font-semibold">
              Hồ sơ đã gửi
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Nộp ngày {formatDate(application.createdAt)}</p>
            {application.attachedCV && (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <a href={`/api/applications/${application._id}/cv`}>
                  <Download aria-hidden="true" />
                  Tải CV
                </a>
              </Button>
            )}
            <p className="mt-4 text-sm font-semibold">Thư giới thiệu</p>
            {application.coverLetter ? (
              <p className="mt-1 max-w-prose whitespace-pre-line">{application.coverLetter}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Ứng viên không gửi thư giới thiệu.</p>
            )}
          </section>

          {profile ? (
            <section aria-labelledby="profile-heading" className="rounded-xl border bg-card p-6">
              <h2 id="profile-heading" className="text-lg font-semibold">
                Hồ sơ ứng viên
              </h2>
              {profile.bio && <p className="mt-3 max-w-prose whitespace-pre-line">{profile.bio}</p>}

              {profile.skills.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Kỹ năng">
                  {profile.skills.map((skill) => (
                    <li key={skill}>
                      <Badge variant="secondary">{skill}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              {links.length > 0 && (
                <p className="mt-4 flex flex-wrap gap-4 text-sm">
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

              <ProfileTimeline
                title="Kinh nghiệm làm việc"
                items={profile.experience.map((item) => ({
                  id: item._id,
                  heading: item.position,
                  sub: [item.company, item.location].filter(Boolean).join(", "),
                  period: formatPeriod(item),
                  description: item.description,
                }))}
              />
              <ProfileTimeline
                title="Học vấn"
                items={profile.education.map((item) => ({
                  id: item._id,
                  heading: item.school,
                  sub: `${item.degree}, ${item.fieldOfStudy}`,
                  period: formatPeriod(item),
                  description: item.description,
                }))}
              />
            </section>
          ) : (
            <p className="rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">Ứng viên chưa điền hồ sơ.</p>
          )}
        </div>

        {/* Cột phải: thao tác của NTD */}
        <aside className="flex flex-col gap-6">
          <section aria-labelledby="status-heading" className="rounded-xl border bg-card p-5">
            <h2 id="status-heading" className="text-lg font-semibold">
              Xử lý đơn
            </h2>
            {withdrawn ? (
              <p className="mt-2 text-sm text-muted-foreground">Ứng viên đã rút đơn. Bạn không thể đổi trạng thái hay hẹn phỏng vấn.</p>
            ) : (
              <div className="mt-4">
                <StatusForm applicationId={application._id} status={status} feedback={application.employerFeedback} />
              </div>
            )}
          </section>

          <section aria-labelledby="interview-heading" className="rounded-xl border bg-card p-5">
            <h2 id="interview-heading" className="text-lg font-semibold">
              Phỏng vấn
            </h2>
            {interviews.length > 0 && (
              <ul className="mt-4 flex flex-col gap-3">
                {interviews.map((interview) => {
                  const past = new Date(interview.date) < now;
                  return (
                    <li
                      key={interview._id}
                      className={cn(
                        "flex gap-3 rounded-md border px-3 py-2 text-sm",
                        past ? "text-muted-foreground" : "border-primary/40 bg-secondary text-secondary-foreground"
                      )}
                    >
                      <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {formatDateTime(interview.date)}
                          {past && " (đã qua)"}
                        </p>
                        <p>{INTERVIEW_TYPE_LABELS[interview.type]}</p>
                        {interview.location && <p className="break-words">{interview.location}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!withdrawn && (
              <div className="mt-4">
                <InterviewForm applicationId={application._id} />
              </div>
            )}
            {withdrawn && interviews.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Không có lịch phỏng vấn.</p>}
          </section>

          <section aria-labelledby="notes-heading" className="rounded-xl border bg-card p-5">
            <h2 id="notes-heading" className="text-lg font-semibold">
              Ghi chú nội bộ
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Chỉ bạn thấy, ứng viên không đọc được.</p>
            <div className="mt-4">
              <NotesPanel applicationId={application._id} notes={application.notes} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ProfileTimeline({
  title,
  items,
}: {
  title: string;
  items: { id: string; heading: string; sub: string; period: string; description?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-x-4">
              <div className="min-w-0">
                <p className="font-medium">{item.heading}</p>
                <p className="text-sm text-muted-foreground">{item.sub}</p>
              </div>
              <p className="text-sm text-muted-foreground">{item.period}</p>
            </div>
            {item.description && <p className="mt-1 whitespace-pre-line text-sm">{item.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
