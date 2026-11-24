import { JobCard } from "@/components/jobs/job-card";
import { saveStateFor, type JobViewer } from "@/lib/api";
import type { Job } from "@/types/api";

interface JobGridProps {
  jobs: Job[];
  viewer?: JobViewer; // người đang xem, để hiện nút "Lưu tin" trên thẻ (lấy bằng getJobViewer())
  emptyTitle?: string;
  emptyText?: string;
}

export function JobGrid({
  jobs,
  viewer,
  emptyTitle = "Chưa có việc làm nào",
  emptyText = "Các tin tuyển dụng mới sẽ hiện ở đây.",
}: JobGridProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-5 py-12 text-center">
        <p className="font-semibold">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard key={job._id} job={job} save={saveStateFor(viewer, job._id)} />
      ))}
    </div>
  );
}
