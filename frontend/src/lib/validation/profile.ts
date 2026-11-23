import { z } from "zod";

// Khớp với backend/src/utils/profileValidation.js (LIMITS, checkUrl, checkPeriod).
// SỬA Ở BACKEND THÌ SỬA CẢ Ở ĐÂY.
export const PROFILE_LIMITS = {
  title: 100,
  shortText: 100,
  bio: 2000,
  description: 1000,
  skills: 30,
  skill: 50,
  url: 300,
};

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} tối đa ${max} ký tự`);

// Để trống, hoặc là link http(s). Link này hiện cho NTD bấm vào nên phải chặn "javascript:".
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(PROFILE_LIMITS.url, `${label} tối đa ${PROFILE_LIMITS.url} ký tự`)
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), {
      message: `${label} phải bắt đầu bằng http:// hoặc https://`,
    });

// "React, Node.js, react" => ["React", "Node.js"] (bỏ ô trống và trùng, không phân biệt hoa thường)
export function parseSkills(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of text.split(",")) {
    const skill = item.trim();
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    result.push(skill);
  }
  return result;
}

// ===== Thông tin chung =====

export const profileSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tiêu đề hồ sơ")
    .max(PROFILE_LIMITS.title, `Tiêu đề tối đa ${PROFILE_LIMITS.title} ký tự`),
  desiredPosition: optionalText("Vị trí mong muốn", PROFILE_LIMITS.shortText),
  location: optionalText("Địa điểm", PROFILE_LIMITS.shortText),
  workType: z.enum(["full-time", "part-time", "contract", "freelance", "internship"]),
  // Người dùng nhập theo triệu đồng; để chuỗi để ô trống không bị đổi thành 0
  desiredSalaryMillions: z
    .string()
    .trim()
    .refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: "Nhập số triệu đồng, ví dụ 15 hoặc 12.5",
    }),
  availableFrom: z.string(), // "yyyy-MM-dd" từ ô date, hoặc rỗng
  bio: optionalText("Giới thiệu", PROFILE_LIMITS.bio),
  skillsText: z.string().superRefine((text, ctx) => {
    const skills = parseSkills(text);
    if (skills.length > PROFILE_LIMITS.skills) {
      ctx.addIssue({ code: "custom", message: `Tối đa ${PROFILE_LIMITS.skills} kỹ năng` });
    }
    if (skills.some((skill) => skill.length > PROFILE_LIMITS.skill)) {
      ctx.addIssue({ code: "custom", message: `Mỗi kỹ năng tối đa ${PROFILE_LIMITS.skill} ký tự` });
    }
  }),
  website: optionalUrl("Website"),
  linkedin: optionalUrl("LinkedIn"),
  github: optionalUrl("GitHub"),
  visibility: z.boolean(),
});

export type ProfileValues = z.infer<typeof profileSchema>;

// ===== Học vấn và kinh nghiệm =====

// Ô <input type="month"> trả "2020-01". Trình duyệt không hỗ trợ (Firefox, Safari máy tính)
// thì hiện ô chữ thường, nên phải tự kiểm tra định dạng.
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthField = z.string().trim();

const periodFields = {
  from: monthField,
  to: monthField,
  current: z.boolean(),
  description: optionalText("Mô tả", PROFILE_LIMITS.description),
};

// Kiểm tra khoảng thời gian, khớp checkPeriod ở backend
function checkPeriod(
  values: { from: string; to: string; current: boolean },
  ctx: z.RefinementCtx
) {
  if (!MONTH.test(values.from)) {
    ctx.addIssue({ code: "custom", path: ["from"], message: "Nhập tháng bắt đầu theo dạng 2020-09" });
    return;
  }
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (values.from > thisMonth) {
    ctx.addIssue({ code: "custom", path: ["from"], message: "Tháng bắt đầu không được ở tương lai" });
  }
  if (values.current) return;
  if (!MONTH.test(values.to)) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "Nhập tháng kết thúc theo dạng 2024-06, hoặc đánh dấu là vẫn đang ở đây",
    });
    return;
  }
  // So sánh chuỗi "yyyy-MM" là so sánh đúng thứ tự thời gian
  if (values.to < values.from) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Tháng kết thúc phải sau tháng bắt đầu" });
  }
}

const required = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Vui lòng nhập ${label}`)
    .max(PROFILE_LIMITS.shortText, `Tối đa ${PROFILE_LIMITS.shortText} ký tự`);

export const educationSchema = z
  .object({
    school: required("tên trường"),
    degree: required("bằng cấp"),
    fieldOfStudy: required("chuyên ngành"),
    ...periodFields,
  })
  .superRefine(checkPeriod);

export const experienceSchema = z
  .object({
    company: required("tên công ty"),
    position: required("vị trí"),
    location: optionalText("Địa điểm", PROFILE_LIMITS.shortText),
    ...periodFields,
  })
  .superRefine(checkPeriod);

export type EducationValues = z.infer<typeof educationSchema>;
export type ExperienceValues = z.infer<typeof experienceSchema>;

// "2020-01" => "2020-01-01" để gửi backend. Ngày ISO từ backend => "2020-01" để điền vào ô.
export const monthToDate = (month: string) => `${month}-01`;
export const dateToMonth = (iso?: string | null) => (iso ? iso.slice(0, 7) : "");
