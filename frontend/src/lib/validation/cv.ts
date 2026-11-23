// Quy tắc file CV, khớp với backend: middlewares/uploads/upload.js.
// SỬA Ở BACKEND THÌ SỬA CẢ Ở ĐÂY.
export const CV_EXTENSIONS = [".pdf", ".doc", ".docx"];
export const CV_MAX_BYTES = 5_000_000;

// Trả câu lỗi nếu file không hợp lệ, hợp lệ thì trả null
export function validateCvFile(file: File | undefined): string | null {
  if (!file) return "Vui lòng chọn file CV";

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!CV_EXTENSIONS.includes(extension)) return "Chỉ nhận file PDF, DOC hoặc DOCX";
  if (file.size > CV_MAX_BYTES) return "File CV tối đa 5MB";

  return null;
}
