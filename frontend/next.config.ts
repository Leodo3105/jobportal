import type { NextConfig } from "next";

// Địa chỉ backend Express. Đổi qua biến môi trường API_URL nếu backend chạy chỗ khác.
const API_URL = process.env.API_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  // Build ra thư mục .next/standalone chỉ gồm những gì cần để chạy (dùng trong Docker image).
  output: "standalone",
  // Lưu ý: rewrites được tính lúc `next build`, nên API_URL phải có ngay khi build (Dockerfile đặt sẵn).
  // Trình duyệt gọi /api/... và /uploads/... tới chính Next.js (cổng 3000),
  // Next.js chuyển tiếp sang backend. Nhờ vậy cookie đăng nhập là first-party.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
