import { formatMonthKey } from "@/lib/format";

// Ô số liệu: nhãn, số lớn, một dòng giải thích. Không có biểu đồ nên không cần tương tác.
export function StatTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString("vi-VN")}</p>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

const CHART_HEIGHT = 120; // px, chiều cao vùng vẽ cột

// Biểu đồ cột nhỏ cho MỘT chuỗi số theo tháng. Các chuỗi (người dùng, tin, đơn) có độ lớn khác nhau
// nên vẽ mỗi chuỗi một biểu đồ riêng (small multiples) thay vì gộp một biểu đồ hai trục.
// Dùng chung cho tổng quan admin và tổng quan NTD.
// Một chuỗi nên một màu (primary), tiêu đề đã gọi tên chuỗi, không cần chú thích.
export function MonthlyBars({ title, unit, months, values }: { title: string; unit: string; months: string[]; values: number[] }) {
  const max = Math.max(...values, 1); // tránh chia cho 0 khi cả 6 tháng đều 0
  const total = values.reduce((sum, n) => sum + n, 0);
  const lastIndex = values.length - 1;

  return (
    <figure className="rounded-xl border bg-card p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{total.toLocaleString("vi-VN")} trong 6 tháng</span>
      </figcaption>

      {/* Vùng vẽ: mỗi tháng một cột. Cả khung cột (không chỉ phần tô màu) là vùng rê chuột/focus. */}
      <div className="mt-6 flex items-end gap-1 border-b" style={{ height: CHART_HEIGHT }}>
        {values.map((value, index) => {
          const height = Math.round((value / max) * (CHART_HEIGHT - 20)); // chừa 20px cho số trên đầu cột
          const label = `${formatMonthKey(months[index], true)}: ${value.toLocaleString("vi-VN")} ${unit}`;
          return (
            <div
              key={months[index]}
              tabIndex={0}
              aria-label={label}
              className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* Chỉ ghi số trên cột tháng hiện tại; các tháng khác xem khi rê chuột hoặc ở bảng */}
              {index === lastIndex && (
                <span className="mb-1 text-xs font-semibold tabular-nums" aria-hidden="true">
                  {value.toLocaleString("vi-VN")}
                </span>
              )}
              <span
                aria-hidden="true"
                // Rộng tối đa 24px, bo 4px ở đầu cột, vuông ở đáy (mọc từ đường đáy)
                className="w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                style={{ height: Math.max(height, value > 0 ? 2 : 0) }}
              />
              {/* Tooltip: hiện khi rê chuột hoặc focus bằng bàn phím */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-card px-2 py-1 text-xs whitespace-nowrap shadow-sm group-hover:block group-focus-visible:block"
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1 text-xs text-muted-foreground" aria-hidden="true">
        {months.map((month) => (
          <span key={month} className="flex-1 text-center">
            {formatMonthKey(month)}
          </span>
        ))}
      </div>
    </figure>
  );
}

// Bảng số liệu của các biểu đồ theo tháng: đọc được không cần nhìn biểu đồ (trình đọc màn hình, in ấn)
export function MonthlyTable({ months, rows }: { months: string[]; rows: { label: string; values: number[] }[] }) {
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">Xem số liệu dạng bảng</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Số lượng mới theo tháng</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Chỉ số
              </th>
              {months.map((month) => (
                <th key={month} scope="col" className="py-2 pr-4 text-right font-medium">
                  {formatMonthKey(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td key={months[index]} className="py-2 pr-4 text-right">
                    {value.toLocaleString("vi-VN")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Top N: thanh ngang mảnh (độ lớn, một màu), số ở đầu thanh, tên bằng chữ. Giữ nguyên thứ tự truyền vào.
export function TopList({
  title,
  items,
  empty,
  unit = "tin",
}: {
  title: string;
  items: { name: string; count: number }[];
  empty: string;
  unit?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{item.count.toLocaleString("vi-VN")} {unit}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
