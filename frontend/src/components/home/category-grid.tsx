import Link from "next/link";

import type { Category } from "@/types/api";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {categories.map((category) => (
        <li key={category._id}>
          <Link
            href={`/jobs?category=${encodeURIComponent(category.name)}`}
            className="flex h-full flex-col rounded-xl border bg-card px-5 py-4 transition-colors hover:border-primary"
          >
            <span className="font-semibold">{category.name}</span>
            {category.description && (
              <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{category.description}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
