import { NextResponse, type NextRequest } from "next/server";

// Middleware chạy TRƯỚC khi render trang. Ở đây chỉ làm việc nhanh và rẻ:
// thiếu cookie "token" thì chuyển ngay sang /login, khỏi render trang rồi mới phát hiện.
//
// Middleware KHÔNG kiểm tra token còn hạn hay vai trò đúng không (việc đó cần gọi backend).
// Phần đó do layout.tsx của từng khu vực làm, qua getCurrentUser().
export function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname + request.nextUrl.search;

  if (request.cookies.has("token")) {
    // Layout (Server Component) không biết URL hiện tại, nên gắn sẵn vào header "x-pathname".
    // Layout cần nó khi token hết hạn để chuyển sang /login?next=<trang này>.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", currentPath);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const loginUrl = new URL("/login", request.url);
  // Ghi nhớ trang đang mở, đăng nhập xong quay lại đúng chỗ (xem lib/auth-redirect.ts)
  loginUrl.searchParams.set("next", currentPath);
  return NextResponse.redirect(loginUrl);
}

// Chỉ chạy cho các khu vực cần đăng nhập. Thêm khu mới thì thêm vào đây.
export const config = {
  matcher: ["/jobseeker/:path*", "/employer/:path*", "/admin/:path*", "/notifications", "/account"],
};
