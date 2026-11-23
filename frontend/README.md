# JobPortal Frontend

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui. Cách chạy cả project, tính năng và API: xem [README ở thư mục gốc](../README.md).

```bash
npm install
npm run dev        # http://localhost:3000, cần backend ở cổng 5000
npm run lint
```

## Cách kết nối backend

- `next.config.ts` dùng `rewrites` chuyển `/api/*` và `/uploads/*` sang backend (`API_URL`, mặc định `http://localhost:5000`). Trình duyệt chỉ gọi tới domain của Next.js nên cookie đăng nhập là first-party.
- **Server Component** gọi thẳng backend qua `src/lib/api.ts` và tự chuyển tiếp cookie của người dùng.
- **Client Component** (form, nút thao tác) gọi `/api/...` qua `src/lib/api-client.ts`, cookie được trình duyệt gửi kèm.

## Bảo vệ các khu riêng

- `src/middleware.ts`: thiếu cookie `token` khi vào `/jobseeker`, `/employer`, `/admin`, `/notifications`, `/account` thì chuyển sang `/login?next=...`.
- `layout.tsx` của từng khu gọi `requireRole(...)` (`src/lib/require-role.ts`) để kiểm tra token còn hợp lệ và đúng vai trò.

## Cấu trúc

```
src/
├── app/                  mỗi thư mục là một route
│   ├── (auth)/           login, register, forgot-password, reset-password
│   ├── jobs/, companies/ trang công khai
│   ├── jobseeker/        khu ứng viên
│   ├── employer/         khu nhà tuyển dụng
│   ├── admin/            khu quản trị
│   └── notifications/, account/
├── components/
│   ├── ui/               component shadcn
│   ├── layout/           header, footer, menu các khu
│   └── <khu>/            component theo từng khu (jobs, apply, jobseeker, employer, admin, dashboard…)
├── lib/                  gọi API, định dạng (format.ts), schema Zod (validation/)
└── types/api.ts          kiểu dữ liệu khớp response của backend
```

Thêm component shadcn: `npx shadcn@latest add <tên>`.
