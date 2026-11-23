import * as React from "react";

import { cn } from "@/lib/utils";

// Thẻ select gốc của trình duyệt, cùng kiểu viền/focus với Input (h-11 như ô nhập trong form)
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}

export { NativeSelect };
