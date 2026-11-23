import { Check, X } from "lucide-react";

import { PASSWORD_RULES } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

// Danh sách điều kiện mật khẩu, đổi màu ngay khi người dùng gõ.
// Không phải Client Component riêng: nó nằm trong form (đã là client) và chỉ nhận props.
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  return (
    <ul id={id} className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        const Icon = passed ? Check : X;

        return (
          <li
            key={rule.label}
            className={cn("flex items-center gap-1.5", passed ? "text-primary" : "text-muted-foreground")}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {rule.label}
            {/* Chỉ trình đọc màn hình đọc phần này, vì icon đã aria-hidden */}
            <span className="sr-only">{passed ? ": đã đạt" : ": chưa đạt"}</span>
          </li>
        );
      })}
    </ul>
  );
}
