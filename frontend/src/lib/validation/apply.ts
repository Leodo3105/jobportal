import { z } from "zod";

import { validateCvFile } from "@/lib/validation/cv";

// Khớp với applyForJob trong backend applicationController.js. SỬA Ở BACKEND THÌ SỬA CẢ Ở ĐÂY.
export const COVER_LETTER_MAX = 2000;

export const applySchema = z
  .object({
    // "profile": dùng CV trong hồ sơ; "upload": gửi file mới chỉ cho đơn này
    cvSource: z.enum(["profile", "upload"]),
    // FileList chỉ có trên trình duyệt, nên dùng z.custom thay vì z.instanceof(FileList)
    // (file schema này cũng được import khi render trên server, nơi không có FileList)
    cvFile: z.custom<FileList>().optional(),
    coverLetter: z.string().trim().max(COVER_LETTER_MAX, `Thư giới thiệu tối đa ${COVER_LETTER_MAX} ký tự`),
  })
  // superRefine: kiểm tra phụ thuộc giữa các field (chỉ bắt chọn file khi cvSource là "upload")
  .superRefine((values, ctx) => {
    if (values.cvSource !== "upload") return;

    const error = validateCvFile(values.cvFile?.[0]);
    if (error) ctx.addIssue({ code: "custom", path: ["cvFile"], message: error });
  });

export type ApplyValues = z.infer<typeof applySchema>;
