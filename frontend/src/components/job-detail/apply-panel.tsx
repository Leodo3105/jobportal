import Link from "next/link";
import { CalendarClock, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_STATUS_LABELS,
  deadlineHint,
  formatDate,
  formatSalary,
  isJobOpen,
  timeAgo,
} from "@/lib/format";
import type { AuthUser, JobDetail, MyApplication } from "@/types/api";

interface ApplyPanelProps {
  job: JobDetail;
  user: AuthUser | null; // null = chưa đăng nhập
  application: MyApplication | null; // đơn của ứng viên cho tin này (kể cả đã rút)
}

export function ApplyPanel({ job, user, application }: ApplyPanelProps) {
  const open = isJobOpen(job);

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">Mức lương</p>
      <p className="mt-1 text-2xl font-bold text-primary">{formatSalary(job)}</p>

      <p className="mt-4 flex items-start gap-2 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          Hạn nộp {formatDate(job.applicationDeadline)}
          {open && <span className="text-muted-foreground"> ({deadlineHint(job.applicationDeadline)})</span>}
        </span>
      </p>

      <div className="mt-5 border-t pt-5">
        <ApplyAction job={job} user={user} application={application} open={open} />
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="size-3.5" aria-hidden="true" />
        {job.views.toLocaleString("vi-VN")} lượt xem, đăng {timeAgo(job.createdAt)}
      </p>
    </div>
  );
}

// Phần hành động đổi theo tình huống. Mỗi nhánh chỉ có tối đa một nút primary.
function ApplyAction({ job, user, application, open }: ApplyPanelProps & { open: boolean }) {
  const applyUrl = `/jobs/${job._id}/apply`;

  // Đã nộp và chưa rút: hiện trạng thái thay cho nút (kể cả khi tin đã đóng)
  if (application && application.status !== "withdrawn") {
    return (
      <div>
        <p className="font-semibold">Bạn đã ứng tuyển ngày {formatDate(application.createdAt)}</p>
        <Badge variant="secondary" className="mt-2">
          {APPLICATION_STATUS_LABELS[application.status]}
        </Badge>
        <Link
          href="/jobseeker/applications"
          className="mt-3 block text-sm font-semibold text-primary hover:underline"
        >
          Xem đơn ứng tuyển của bạn
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <div>
        <p className="font-semibold">Tin này đã ngừng nhận hồ sơ</p>
        <Link href="/jobs" className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
          Xem các việc làm đang tuyển
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <Button asChild size="lg" className="h-11 w-full">
          <Link href={`/login?next=${encodeURIComponent(applyUrl)}`}>Đăng nhập để ứng tuyển</Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    );
  }

  if (user.role !== "jobseeker") {
    return (
      <p className="text-sm text-muted-foreground">
        Chỉ tài khoản ứng viên mới ứng tuyển được. Bạn đang đăng nhập bằng tài khoản{" "}
        {user.role === "employer" ? "nhà tuyển dụng" : "quản trị"}.
      </p>
    );
  }

  // Ứng viên chưa nộp, hoặc đã rút đơn (được nộp lại)
  return (
    <div>
      <Button asChild size="lg" className="h-11 w-full">
        <Link href={applyUrl}>{application ? "Ứng tuyển lại" : "Ứng tuyển"}</Link>
      </Button>
      {application && (
        <p className="mt-3 text-sm text-muted-foreground">
          Bạn đã rút đơn ứng tuyển vị trí này. Bạn có thể nộp lại.
        </p>
      )}
    </div>
  );
}
