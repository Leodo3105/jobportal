// Quy tắc ảnh tải lên (logo công ty, avatar), khớp backend:
// middlewares/uploads/imageFilter.js (đuôi file, không nhận SVG) và giới hạn 2MB của
// logoUpload.js / avatarUpload.js. SỬA Ở BACKEND THÌ SỬA CẢ Ở ĐÂY.
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
export const IMAGE_MAX_BYTES = 2_000_000;

// Trả câu lỗi nếu file không hợp lệ, hợp lệ thì trả null
export function validateImageFile(file: File | undefined, label = "ảnh"): string | null {
  if (!file) return `Vui lòng chọn ${label}`;
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(extension)) return "Chỉ nhận ảnh JPG, PNG, GIF hoặc WEBP";
  if (file.size > IMAGE_MAX_BYTES) return "Ảnh tối đa 2MB";
  return null;
}
