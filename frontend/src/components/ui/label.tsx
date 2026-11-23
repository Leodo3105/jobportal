import * as React from "react";

import { cn } from "@/lib/utils";

// Nhãn cho ô nhập. Dùng thẻ <label> thường: htmlFor trỏ tới id của ô nhập,
// bấm vào nhãn thì con trỏ nhảy vào ô, trình đọc màn hình đọc nhãn khi focus ô.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export { Label };
