import { postJson } from "@/lib/api-client";

// Giữ lại các export cũ để các form auth không phải sửa import
export { ApiError, errorMessage } from "@/lib/api-client";

// postAuth("login", {...}) gửi POST /api/auth/login
export function postAuth<T>(path: string, body: object): Promise<T> {
  return postJson<T>(`/api/auth/${path}`, body);
}
