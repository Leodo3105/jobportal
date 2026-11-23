import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: {
    default: "JobPortal - Tìm việc làm phù hợp",
    template: "%s | JobPortal", // trang con sẽ có tiêu đề dạng "Việc làm | JobPortal"
  },
  description: "Tìm việc làm, ứng tuyển trực tuyến và theo dõi đơn ứng tuyển.",
};

// Layout gốc: bọc mọi trang. Header và footer chỉ viết một lần ở đây.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
