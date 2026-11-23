import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

interface SelectFilter {
  name: string;
  label: string; // nhãn ẩn cho trình đọc màn hình
  value?: string;
  options: { value: string; label: string }[]; // option đầu tiên nên là "Tất cả..." với value ""
}

// Form GET thuần cho các trang danh sách admin: gửi đi là đổi URL, Server Component tự lọc.
export function FilterForm({
  action,
  searchPlaceholder,
  search,
  selects,
}: {
  action: string;
  searchPlaceholder: string;
  search?: string;
  selects: SelectFilter[];
}) {
  return (
    <form
      action={action}
      method="GET"
      role="search"
      className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row"
    >
      <label className="relative sm:flex-[2]">
        <span className="sr-only">{searchPlaceholder}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input name="search" placeholder={searchPlaceholder} defaultValue={search} className="h-11 pl-9" />
      </label>
      {selects.map((select) => (
        <label key={select.name} className="sm:flex-1">
          <span className="sr-only">{select.label}</span>
          <NativeSelect name={select.name} defaultValue={select.value ?? ""}>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
      ))}
      <Button type="submit" variant="outline" className="h-11 shrink-0">
        Lọc
      </Button>
    </form>
  );
}
