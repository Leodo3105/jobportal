import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight" aria-label="JobPortal, về trang chủ">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" className="fill-primary" />
        {/* Hình chiếc cặp đơn giản */}
        <rect x="6" y="10" width="16" height="11" rx="2" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M11 10V8.5A1.5 1.5 0 0 1 12.5 7h3A1.5 1.5 0 0 1 17 8.5V10" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
      <span>JobPortal</span>
    </Link>
  );
}
