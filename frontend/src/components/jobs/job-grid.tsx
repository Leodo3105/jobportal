import { JobCard } from "@/components/jobs/job-card";
import type { Job } from "@/types/api";

interface JobGridProps {
  jobs: Job[];
  emptyTitle?: string;
  emptyText?: string;
}

export function JobGrid({
  jobs,
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
        <JobCard key={job._id} job={job} />
      ))}
    </div>
  );
}
