import { Building2, UserRound } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import type { RegisterRole } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const OPTIONS: { value: RegisterRole; title: string; description: string; Icon: typeof UserRound }[] = [
  { value: "jobseeker", title: "Ứng viên", description: "Tìm việc, ứng tuyển", Icon: UserRound },
  { value: "employer", title: "Nhà tuyển dụng", description: "Đăng tin, tìm ứng viên", Icon: Building2 },
];

export function RolePicker({ value, field }: { value: RegisterRole; field: UseFormRegisterReturn<"role"> }) {
  return (
    // fieldset + legend: nhóm các radio lại và đặt tên chung cho nhóm là "Bạn là"
    <fieldset>
      <legend className="text-sm font-medium">Bạn là</legend>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value: optionValue, title, description, Icon }) => {
          const checked = value === optionValue;
          return (
            <label
              key={optionValue}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border bg-card p-3 transition-colors",
                // has-[:focus-visible]: viền focus khi radio bên trong được chọn bằng bàn phím
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                checked ? "border-2 border-primary bg-secondary p-[11px]" : "hover:border-primary/50"
              )}
            >
              {/* defaultChecked: HTML render từ server đã có sẵn radio được chọn.
                  Sau đó react-hook-form tiếp quản (input "uncontrolled", RHF đọc qua ref). */}
              <input type="radio" value={optionValue} defaultChecked={checked} className="sr-only" {...field} />
              <span className="flex items-center gap-2 font-semibold">
                <Icon className={cn("size-4 shrink-0", checked ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                {title}
              </span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
