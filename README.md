# JobPortal

[![CI](https://github.com/Leodo3105/jobportal/actions/workflows/ci.yml/badge.svg)](https://github.com/Leodo3105/jobportal/actions/workflows/ci.yml)

Website tuyển dụng gồm ba vai trò: **ứng viên** tìm việc và nộp hồ sơ, **nhà tuyển dụng** đăng tin và xử lý đơn, **quản trị viên** quản lý người dùng, tin, công ty và danh mục.

- **Backend:** Node.js, Express 4, MongoDB (Mongoose 8), JWT trong cookie httpOnly, multer, nodemailer.
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Hook Form + Zod.

## Tính năng

**Khách (không cần đăng nhập)**
- Tìm việc theo từ khoá, địa điểm, ngành nghề; phân trang; xem chi tiết tin và việc tương tự.
- Danh sách công ty, trang công ty kèm các việc đang tuyển.
- Đăng ký (ứng viên hoặc nhà tuyển dụng), đăng nhập, quên và đặt lại mật khẩu qua email.

**Ứng viên**
- Hồ sơ: thông tin chung, kỹ năng, kinh nghiệm, học vấn, liên kết mạng xã hội.
- Quản lý CV (PDF/DOC/DOCX ≤ 5MB); nộp đơn bằng CV trong hồ sơ hoặc tải file riêng, kèm thư giới thiệu.
- Theo dõi đơn: trạng thái, lịch phỏng vấn, phản hồi của nhà tuyển dụng; rút đơn và ứng tuyển lại.

**Nhà tuyển dụng**
- Trang tổng quan: số tin đang hiện, đơn chưa xem, biểu đồ 6 tháng, tin nhiều đơn nhất.
- Thông tin công ty và logo; đăng, sửa, đổi trạng thái, xoá tin. Tin hết hạn nộp được báo qua thông báo; gia hạn thì tin tự mở lại.
- Xử lý đơn: xem hồ sơ và CV ứng viên, đổi trạng thái kèm phản hồi, hẹn phỏng vấn, ghi chú nội bộ (ứng viên không thấy).

**Quản trị viên**
- Tổng quan toàn hệ thống kèm biểu đồ theo tháng.
- Người dùng: lọc, khoá/mở khoá (đăng xuất ngay mọi phiên), xoá kèm toàn bộ dữ liệu.
- Tin tuyển dụng: đổi trạng thái, đánh dấu nổi bật, xoá. Công ty: đổi gói dịch vụ. Danh mục: thêm, đổi tên (tin và công ty đổi theo), ẩn, xoá.

**Mọi vai trò:** thông báo (chuông kèm số chưa đọc), cài đặt tài khoản (ảnh đại diện, thông tin, đổi mật khẩu).

**Tự động (mỗi giờ):** tin quá hạn nộp chuyển sang "Hết hạn"; gói dịch vụ trả phí hết hạn về gói Miễn phí và bỏ đánh dấu nổi bật. Nhà tuyển dụng nhận thông báo cho từng trường hợp.

## Điểm kỹ thuật đáng chú ý

- **Đăng nhập bằng cookie httpOnly** (`SameSite=Lax`, thêm `Secure` khi production). Next.js dùng `rewrites` chuyển `/api` và `/uploads` sang backend, nên cookie là first-party và JavaScript phía trình duyệt không đọc được token.
- **Thu hồi phiên:** JWT mang `tokenVersion`; đổi hoặc đặt lại mật khẩu, bị khoá tài khoản thì mọi token cũ hết hiệu lực.
- **Chống CSRF:** request ghi dữ liệu có header `Origin` lạ bị từ chối (403).
- **Chống NoSQL injection:** giá trị từ body và query string phải là chuỗi trước khi đưa vào truy vấn (Express đọc `?a[$ne]=x` thành object); input được escape trước khi dùng trong `$regex`.
- **Phân quyền theo vai trò** ở middleware (`protect`, `authorize`), không nhận các field đặc quyền từ body (`role`, `featured`, `status`, gói dịch vụ…).
- **File tải lên:** chống path traversal khi xử lý tên file; CV không phục vụ tĩnh mà chỉ tải được qua API có kiểm tra quyền.
- **Rate limit** cho đăng nhập, đăng ký, quên mật khẩu và đổi mật khẩu.
- **Tác vụ định kỳ** bằng `node-cron` chạy trong server (`src/jobs/`), chạy lại nhiều lần không tạo thay đổi hay thông báo trùng; chạy tay được bằng `npm run tasks`.
- **Thống kê theo tháng** đếm bằng `aggregate`, nhóm theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).

## Chạy trên máy

**Cần có:** Node.js ≥ 18, MongoDB ≥ 5.0 đang chạy ở `127.0.0.1:27017` (hoặc chuỗi kết nối MongoDB Atlas).

**1. Backend** (cổng 5000)

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# sửa .env: MONGO_URI, JWT_SECRET
npm run seed                # dữ liệu demo (tuỳ chọn)
npm run dev                 # tự chạy tác vụ định kỳ mỗi giờ
```

**2. Frontend** (cổng 3000), mở terminal khác

```bash
cd frontend
npm install
npm run dev
```

Mở http://localhost:3000.

**Tài khoản demo** (sau khi chạy `npm run seed`, mật khẩu chung `Demo@1234`):

| Vai trò | Email |
|---|---|
| Ứng viên | `ungvien@demo.vn` |
| Nhà tuyển dụng | `hr.techviet@demo.vn` |

Tài khoản admin không đăng ký được trên giao diện, tạo bằng lệnh:

```bash
cd backend
npm run create-admin -- admin@demo.vn "Demo@1234" "Quản trị"
```

**Chạy tác vụ định kỳ ngay** (không đợi tới đầu giờ): `cd backend && npm run tasks`.

**Quên mật khẩu khi chạy ở máy:** để `SMTP_HOST` trống trong `.env`, link đặt lại mật khẩu được in ra console của backend thay vì gửi email.

## Chạy bằng Docker

Dựng cả MongoDB, backend, frontend và Caddy (reverse proxy) ở chế độ production bằng một lệnh. Không cần cài Node hay MongoDB, chỉ cần Docker (Docker Desktop trên Windows/macOS).

```bash
cp .env.example .env          # ở thư mục gốc; Windows: copy .env.example .env
# sửa .env: đặt JWT_SECRET (≥ 32 ký tự), tạo bằng:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d --build
```

Mở http://localhost:8080. Lần build đầu mất vài phút.

```
Trình duyệt ─► caddy :8080 ─► frontend (Next.js) ─rewrite /api, /uploads─► backend :5000 ─► mongo
```

- Chỉ Caddy mở cổng ra ngoài; frontend, backend và MongoDB nằm trong mạng nội bộ của Compose.
- Dữ liệu nằm trong 2 volume `mongo-data` (database) và `uploads` (avatar, logo, CV), còn nguyên sau khi tắt hay dựng lại container.
- Tác vụ định kỳ chạy trong container backend.

| Việc | Lệnh |
|---|---|
| Dữ liệu demo | `docker compose exec -e NODE_ENV=development backend npm run seed` (seed tự chặn khi production, phải ghi đè rõ ràng) |
| Tạo admin | `docker compose exec backend npm run create-admin -- admin@demo.vn "Demo@1234" "Quản trị"` |
| Xem log | `docker compose logs -f backend` |
| Dừng (giữ dữ liệu) | `docker compose down` |
| Dừng và xoá hết dữ liệu | `docker compose down -v` |

**Biến trong `.env` gốc** (xem `.env.example`): `APP_PORT`, `APP_URL` (phải khớp địa chỉ gõ trên trình duyệt, dùng cho chống CSRF và link email), `JWT_SECRET` (bắt buộc; thiếu thì Compose không chạy, yếu thì backend tự dừng), `COOKIE_SECURE=false` (đăng nhập được qua `http://`; bỏ khi có HTTPS), `SMTP_*` (để trống thì chức năng quên mật khẩu báo lỗi, vì production không in link ra log).

**Vì sao có Caddy:** khi rewrite `/api` sang backend, Next.js không tự gắn IP người dùng mà chuyển nguyên header `X-Forwarded-For` client gửi lên, nên kẻ tấn công giả header là né được rate limit đăng nhập. Caddy bỏ header giả và đặt IP thật. Khi deploy lên VPS có tên miền, đổi `:80` trong `Caddyfile` thành tên miền là Caddy tự cấp HTTPS.

### Biến môi trường (`backend/.env`)

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng backend, mặc định 5000 |
| `NODE_ENV` | `production` thì cookie có `Secure` và bắt buộc có SMTP |
| `CLIENT_URL` | Origin của frontend (nhiều giá trị cách nhau bằng dấu phẩy), dùng cho CORS, chống CSRF và link trong email |
| `TRUST_PROXY` | Số proxy đứng trước API (ví dụ `1` sau Nginx). Để trống khi không có proxy |
| `MONGO_URI` | Chuỗi kết nối MongoDB |
| `JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_DAYS` | Khoá ký JWT (production: ≥ 32 ký tự, không thì server không chạy), hạn token, số ngày sống của cookie |
| `COOKIE_SECURE` | `false` để bỏ cờ `Secure` của cookie khi chạy production qua `http://`; để trống thì tự bật khi production |
| `SMTP_*`, `FROM_NAME`, `FROM_EMAIL` | Cấu hình gửi email |

Frontend chỉ có `API_URL` (mặc định `http://localhost:5000`), xem `frontend/.env.example`.

## Test

Backend có 7 bộ test end-to-end gọi API thật (khoảng 420 kiểm tra), gồm một bộ smoke gọi gần 90 endpoint với đúng vai trò và báo lỗi nếu có bất kỳ response 500 nào.

**CI (GitHub Actions, `.github/workflows/ci.yml`):** mỗi lần push lên `main` hoặc mở pull request, chạy song song 3 việc trên bản checkout sạch: cả 7 bộ e2e (với MongoDB), lint + type-check + build frontend, và build Docker rồi dựng thử cả stack qua Caddy.

```bash
cd backend
npm run test:e2e              # chạy mọi bộ
npm run test:e2e -- smoke     # chỉ bộ có tên chứa "smoke"
```

Mỗi bộ tự khởi động một server riêng với cổng riêng và database tạm riêng (`jobportal_e2e_<tên>`), xoá sạch sau khi chạy, nên không ảnh hưởng dữ liệu đang dùng. Cần MongoDB ở `127.0.0.1:27017` (hoặc đặt biến `TEST_MONGO_BASE`).

## Cấu trúc thư mục

```
docker-compose.yml       MongoDB + backend + frontend + Caddy
Caddyfile                reverse proxy, cổng vào duy nhất
backend/
  Dockerfile
  src/
    server.js            khởi tạo Express, middleware bảo mật, gắn route
    config/              kết nối DB, đường dẫn upload, danh sách origin
    routes/              chia theo nghiệp vụ: auth, jobseeker, employer, job, chat,
    controllers/         notification, category, admin, dashboard
    models/
    middlewares/         protect/authorize, checkOrigin, validateObjectId, xử lý lỗi, multer
    utils/               kiểm tra dữ liệu, escape regex, cookie, gửi email, xoá tài khoản
    jobs/                tác vụ định kỳ (tin và gói hết hạn) và lịch chạy node-cron
  scripts/               createAdmin.js, seed.js, runScheduledTasks.js
  tests/                 run-all.mjs + e2e/*.mjs
frontend/
  Dockerfile             build 3 giai đoạn, chạy bản standalone của Next.js
  src/
    app/                 mỗi thư mục là một route (jobseeker/, employer/, admin/ là các khu riêng)
    components/          ui/ (shadcn), layout/, và component theo từng khu
    lib/                 gọi API (server và trình duyệt), định dạng, schema Zod
    types/api.ts         kiểu dữ liệu khớp response của backend
    middleware.ts        chặn các khu cần đăng nhập khi thiếu cookie
```

## API

Mọi API có tiền tố `/api`. Ký hiệu: 🔓 công khai, 🔑 cần đăng nhập, [JS] ứng viên, [EMP] nhà tuyển dụng, [AD] admin.

| Nhóm | Endpoint chính |
|---|---|
| Auth `/auth` | `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `PUT /me`, `PUT /password`, `POST /forgot-password`, `POST /reset-password` |
| Việc làm `/jobs` | `GET /` 🔓 (lọc, phân trang), `GET /:id` 🔓, `GET /:id/similar` 🔓, `POST /`, `PUT /:id`, `PUT /:id/status`, `DELETE /:id` [EMP, AD], `GET /employer/myjobs` [EMP] |
| Ứng tuyển `/applications` | `POST /apply`, `PUT /:id/cancel`, `GET /user/myapplications` [JS]; `GET /job/:jobId`, `PUT /:id/status`, `PUT /:id/schedule-interview`, `PUT /:id/notes` [EMP, AD]; `GET /:id`, `GET /:id/cv` 🔑 |
| Hồ sơ `/profiles` | `GET`, `POST`, `PUT /` (kèm kinh nghiệm, học vấn) [JS]; `PUT`/`DELETE /avatar` 🔑; `DELETE /` 🔑 (xoá tài khoản) |
| CV `/cv` | `PUT /upload`, `DELETE /` [JS]; `GET /:filename` 🔑 (chủ CV, admin, NTD có đơn dùng CV đó) |
| Công ty `/companies` | `GET /all`, `GET /:id` 🔓; `GET`, `POST`, `PUT /`, `PUT /logo`, `GET /stats` [EMP] |
| Danh mục `/categories` | `GET /`, `GET /type/:type` 🔓; `POST`, `PUT /:id`, `DELETE /:id` [AD] |
| Thông báo `/notifications` | `GET /`, `PUT /:id/read`, `PUT /read-all`, `DELETE /:id` 🔑 |
| Tổng quan `/dashboard` | `GET /admin`, `GET /employer`, `GET /jobseeker` |
| Quản trị `/admin` [AD] | `GET /users`, `PUT /users/:id/status`, `DELETE /users/:id`, `GET /jobs`, `PUT /jobs/:id/featured`, `GET /companies`, `PUT /companies/:id/subscription`, `GET /categories` |
| Khác | `/saved-jobs` [JS], `/messages` 🔑 (chưa có giao diện) |

## Hướng phát triển

- Deploy lên VPS: tên miền, HTTPS (Caddy đã sẵn), sao lưu volume.
- Thanh toán gói dịch vụ qua VNPay; tìm ứng viên cho gói trả phí.
- Giao diện tin nhắn, cập nhật realtime bằng socket.io.
