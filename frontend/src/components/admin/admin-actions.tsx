"use client";

import { useState } from "react";

import { ConfirmAction, ErrorText, Spinner, useAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteRequest, putJson } from "@/lib/api-client";
import { PLAN_LABELS } from "@/lib/format";
import type { SubscriptionPlan, UserRole } from "@/types/api";

// ===== Người dùng =====

export function UserStatusButton({ userId, name, isActive }: { userId: string; name: string; isActive: boolean }) {
  const { pending, error, run } = useAction();
  const setStatus = (value: boolean) => putJson(`/api/admin/users/${userId}/status`, { isActive: value });

  if (isActive) {
    return (
      <ConfirmAction
        trigger="Khoá"
        question={`Khoá tài khoản ${name}? Người này bị đăng xuất ngay và không đăng nhập lại được.`}
        confirmLabel="Khoá"
        keepLabel="Huỷ"
        groupLabel={`Khoá tài khoản ${name}`}
        onConfirm={() => setStatus(false)}
      />
    );
  }

  // Mở khoá không gây hại nên chỉ cần một bước
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={() => run(() => setStatus(true))} disabled={pending} aria-label={`Mở khoá tài khoản ${name}`}>
        {pending && <Spinner />}
        Mở khoá
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

// Hậu quả khác nhau theo vai trò, nói rõ để admin cân nhắc trước khi xoá
const DELETE_USER_CONSEQUENCE: Partial<Record<UserRole, string>> = {
  jobseeker: "Hồ sơ, CV và mọi đơn ứng tuyển của người này sẽ bị xoá vĩnh viễn.",
  employer: "Công ty, mọi tin tuyển dụng và toàn bộ đơn ứng tuyển vào các tin đó sẽ bị xoá vĩnh viễn.",
};

export function DeleteUserButton({ userId, name, role }: { userId: string; name: string; role: UserRole }) {
  return (
    <ConfirmAction
      trigger="Xoá"
      question={`Xoá tài khoản ${name}? ${DELETE_USER_CONSEQUENCE[role] ?? "Dữ liệu sẽ bị xoá vĩnh viễn."}`}
      hint='Nếu chỉ muốn chặn đăng nhập, hãy dùng "Khoá" (mở lại được).'
      confirmLabel="Xoá tài khoản"
      keepLabel="Giữ tài khoản"
      groupLabel={`Xoá tài khoản ${name}`}
      onConfirm={() => deleteRequest(`/api/admin/users/${userId}`)}
    />
  );
}

// ===== Tin tuyển dụng =====

export function JobFeaturedToggle({ jobId, title, featured }: { jobId: string; title: string; featured: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={featured}
          disabled={pending}
          aria-label={`Tin nổi bật: ${title}`}
          onChange={(event) => run(() => putJson(`/api/admin/jobs/${jobId}/featured`, { featured: event.target.checked }))}
        />
        Nổi bật
      </label>
      <ErrorText error={error} />
    </div>
  );
}

export function DeleteJobButton({ jobId, title }: { jobId: string; title: string }) {
  return (
    <ConfirmAction
      trigger="Xoá"
      question={`Xoá tin "${title}"? Mọi đơn ứng tuyển của tin này cũng bị xoá và không khôi phục được.`}
      confirmLabel="Xoá tin"
      keepLabel="Giữ tin"
      groupLabel={`Xoá tin ${title}`}
      onConfirm={() => deleteRequest(`/api/jobs/${jobId}`)}
    />
  );
}

// ===== Công ty: gói dịch vụ =====

const PLANS: SubscriptionPlan[] = ["free", "basic", "premium", "enterprise"];

// "2030-01-31T..." => "2030-01-31" cho ô date
const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function SubscriptionForm({
  companyId,
  name,
  plan,
  endDate,
}: {
  companyId: string;
  name: string;
  plan: SubscriptionPlan;
  endDate?: string;
}) {
  const { pending, error, run } = useAction();
  const [nextPlan, setNextPlan] = useState<SubscriptionPlan>(plan);
  const [nextEnd, setNextEnd] = useState(plan === "free" ? "" : toDateInput(endDate));
  const [saved, setSaved] = useState(false);
  const paid = nextPlan !== "free";
  const changed = nextPlan !== plan || (paid && nextEnd !== toDateInput(endDate));

  return (
    <form
      className="flex flex-col items-end gap-2"
      aria-label={`Gói dịch vụ của ${name}`}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaved(false);
        // Ngày hết hạn tính hết ngày đó theo giờ Việt Nam
        const body = paid ? { type: nextPlan, endDate: `${nextEnd}T23:59:59+07:00` } : { type: nextPlan };
        if (await run(() => putJson(`/api/admin/companies/${companyId}/subscription`, body))) setSaved(true);
      }}
    >
      <div className="flex flex-wrap justify-end gap-2">
        <NativeSelect
          aria-label={`Gói của ${name}`}
          className="h-9 w-auto"
          value={nextPlan}
          onChange={(event) => setNextPlan(event.target.value as SubscriptionPlan)}
        >
          {PLANS.map((value) => (
            <option key={value} value={value}>
              {PLAN_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        {paid && (
          <Input
            type="date"
            aria-label={`Ngày hết hạn gói của ${name}`}
            className="h-9 w-auto"
            value={nextEnd}
            required
            onChange={(event) => setNextEnd(event.target.value)}
          />
        )}
        <Button type="submit" size="sm" className="h-9" disabled={pending || !changed || (paid && !nextEnd)}>
          {pending && <Spinner />}
          Lưu gói
        </Button>
      </div>
      {saved && !changed && <p className="text-sm text-primary">Đã lưu.</p>}
      <ErrorText error={error} />
    </form>
  );
}
