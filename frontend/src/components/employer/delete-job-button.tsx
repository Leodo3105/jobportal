"use client";

import { ConfirmAction } from "@/components/confirm-action";
import { deleteRequest } from "@/lib/api-client";

// NTD xoá tin của mình. Backend xoá luôn đơn ứng tuyển và việc đã lưu của tin này.
export function DeleteJobButton({
  jobId,
  title,
  applicationCount,
}: {
  jobId: string;
  title: string;
  applicationCount: number;
}) {
  const question =
    applicationCount > 0
      ? `Xoá tin "${title}"? ${applicationCount} đơn ứng tuyển của tin này cũng bị xoá và không khôi phục được.`
      : `Xoá tin "${title}"? Không khôi phục được.`;

  return (
    <ConfirmAction
      trigger="Xoá tin"
      triggerStyle="link"
      question={question}
      hint={applicationCount > 0 ? 'Nếu chỉ muốn ngừng nhận hồ sơ, hãy đổi trạng thái sang "Đã đóng".' : undefined}
      confirmLabel="Xoá tin"
      keepLabel="Giữ tin"
      groupLabel={`Xoá tin ${title}`}
      onConfirm={() => deleteRequest(`/api/jobs/${jobId}`)}
    />
  );
}
