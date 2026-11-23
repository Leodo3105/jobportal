import { MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types/api";

interface SearchFormProps {
  categories: Category[];
  defaultValues?: { keyword?: string; location?: string; category?: string };
}

export function SearchForm({ categories, defaultValues = {} }: SearchFormProps) {
  return (
    <form
      action="/jobs"
      method="GET"
      role="search"
      className="grid gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid-cols-[1.5fr_1fr_1fr_auto]"
    >
      <label className="relative">
        <span className="sr-only">Từ khóa</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          name="keyword"
          placeholder="Vị trí, kỹ năng, ví dụ: React"
          defaultValue={defaultValues.keyword}
          className="h-11 pl-9"
        />
      </label>

      <label className="relative">
        <span className="sr-only">Địa điểm</span>
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          name="location"
          placeholder="Tỉnh, thành phố"
          defaultValue={defaultValues.location}
          className="h-11 pl-9"
        />
      </label>

      <label>
        <span className="sr-only">Ngành nghề</span>
        {/* Dùng thẻ select gốc của trình duyệt cho đơn giản, chỉ thêm style cho đồng bộ */}
        <select
          name="category"
          defaultValue={defaultValues.category ?? ""}
          className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Tất cả ngành nghề</option>
          {categories.map((category) => (
            <option key={category._id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" size="lg" className="h-11">
        Tìm việc
      </Button>
    </form>
  );
}
