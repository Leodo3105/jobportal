// Gọi API từ TRÌNH DUYỆT (Client Component), đi qua rewrites của Next.js nên cookie tự được gửi.
// Server Component thì dùng lib/api.ts.

const NETWORK_ERROR = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
const RATE_LIMIT_ERROR = "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.";
const UNKNOWN_ERROR = "Đã có lỗi xảy ra. Vui lòng thử lại.";

// Lỗi có kèm mã HTTP, để form biết phải hiện lỗi ở đâu (ví dụ 401 là sai mật khẩu).
// status = 0 nghĩa là không nhận được phản hồi hợp lệ từ backend.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Đọc body dạng JSON. Body không phải JSON (ví dụ trang lỗi HTML) thì trả null.
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Lấy câu báo lỗi trong body { success: false, error: "..." } của backend
function errorFromBody(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return null;
}

type Method = "POST" | "PUT" | "DELETE";

// Hàm chung: gửi request ghi dữ liệu, đổi mọi kiểu lỗi thành ApiError
async function send<T>(method: Method, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method, ...init });
  } catch {
    // fetch chỉ ném lỗi khi không gửi được request (mất mạng, Next.js đã tắt...)
    throw new ApiError(NETWORK_ERROR, 0);
  }

  const data = await readJson(res);

  // Backend tắt thì rewrites của Next.js trả trang lỗi HTML (mã 500), không phải JSON.
  if (data === null) {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  if (res.status === 429) {
    throw new ApiError(RATE_LIMIT_ERROR, 429);
  }

  if (!res.ok) {
    throw new ApiError(errorFromBody(data) ?? UNKNOWN_ERROR, res.status);
  }

  return data as T;
}

// Gửi JSON, ví dụ form đăng nhập
export function postJson<T>(path: string, body: object): Promise<T> {
  return send<T>("POST", path, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Gửi FormData (có file). KHÔNG tự đặt Content-Type: trình duyệt sẽ tự thêm
// "multipart/form-data; boundary=..." — boundary là chuỗi ngăn cách các phần trong body.
export function postForm<T>(path: string, formData: FormData): Promise<T> {
  return send<T>("POST", path, { body: formData });
}

export function putJson<T>(path: string, body: object): Promise<T> {
  return send<T>("PUT", path, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function putForm<T>(path: string, formData: FormData): Promise<T> {
  return send<T>("PUT", path, { body: formData });
}

// PUT không có body, ví dụ rút đơn: PUT /api/applications/:id/cancel
export function putEmpty<T>(path: string): Promise<T> {
  return send<T>("PUT", path);
}

// body: chỉ khi API cần (ví dụ DELETE /api/auth/me cần { password })
export function deleteRequest<T>(path: string, body?: object): Promise<T> {
  if (!body) return send<T>("DELETE", path);
  return send<T>("DELETE", path, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Đổi một lỗi bất kỳ thành câu để hiện cho người dùng
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNKNOWN_ERROR;
}
