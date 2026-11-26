import { z } from "zod";

import { PROFILE_LIMITS, parseSkills } from "@/lib/validation/profile";

// Khớp với backend/src/utils/employerValidation.js (EMPLOYER_LIMITS). SỬA Ở BACKEND THÌ SỬA CẢ Ở ĐÂY.
// Quy tắc ảnh logo: lib/validation/image.ts.
export const EMPLOYER_LIMITS = {
  companyName: 100,
  companyDescription: 3000,
  shortText: 100,
  address: 200,
  jobTitle: 150,
  jobText: 5000,
};

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Vui lòng nhập ${label}`)
    .max(max, `Tối đa ${max} ký tự`);

// Ngành nghề: chọn trong danh mục ngành đang hiện (backend kiểm tra lại, xem utils/checkIndustry.js)
const industryChoice = z.string().trim().min(1, "Vui lòng chọn ngành nghề");

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(PROFILE_LIMITS.url, `Tối đa ${PROFILE_LIMITS.url} ký tự`)
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), {
      message: `${label} phải bắt đầu bằng http:// hoặc https://`,
    });

// Chuỗi rỗng hoặc số không âm (ô nhập số để dạng chuỗi để ô trống không bị đổi thành 0)
const optionalNumber = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), { message });

// ===== Công ty =====

export const companySchema = z.object({
  name: requiredText("tên công ty", EMPLOYER_LIMITS.companyName),
  industry: industryChoice,
  companySize: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]),
  location: requiredText("địa chỉ", EMPLOYER_LIMITS.address),
  foundedYear: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d{4}$/.test(value) && Number(value) >= 1800 && Number(value) <= new Date().getFullYear()),
      { message: `Năm thành lập từ 1800 đến ${new Date().getFullYear()}` }
    ),
  description: requiredText("mô tả công ty", EMPLOYER_LIMITS.companyDescription),
  website: optionalUrl("Website"),
  facebook: optionalUrl("Facebook"),
  linkedin: optionalUrl("LinkedIn"),
});

export type CompanyValues = z.infer<typeof companySchema>;

// ===== Tin tuyển dụng =====

export const jobSchema = z
  .object({
    title: requiredText("tiêu đề", EMPLOYER_LIMITS.jobTitle),
    category: industryChoice,
    location: requiredText("địa điểm", EMPLOYER_LIMITS.shortText),
    jobType: z.enum(["full-time", "part-time", "contract", "freelance", "internship"]),
    experienceLevel: z.enum(["entry", "junior", "mid-level", "senior", "executive"]),
    educationLevel: z.enum(["high-school", "associate", "bachelor", "master", "phd", "any"]),
    salaryCurrency: z.enum(["VND", "USD"]),
    salaryMin: optionalNumber("Nhập một số, ví dụ 15"),
    salaryMax: optionalNumber("Nhập một số, ví dụ 25"),
    showSalary: z.boolean(),
    skillsText: z.string().refine((text) => parseSkills(text).length <= PROFILE_LIMITS.skills, {
      message: `Tối đa ${PROFILE_LIMITS.skills} kỹ năng`,
    }),
    applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn hạn nộp hồ sơ"),
    description: requiredText("mô tả công việc", EMPLOYER_LIMITS.jobText),
    requirements: requiredText("yêu cầu ứng viên", EMPLOYER_LIMITS.jobText),
    benefits: requiredText("quyền lợi", EMPLOYER_LIMITS.jobText),
  })
  .superRefine((values, ctx) => {
    if (values.salaryMin !== "" && values.salaryMax !== "" && Number(values.salaryMin) > Number(values.salaryMax)) {
      ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu" });
    }
  });

export type JobFormValues = z.infer<typeof jobSchema>;

// Lương VND nhập theo triệu đồng cho dễ gõ; USD nhập số đầy đủ
export const salaryFactor = (currency: string) => (currency === "VND" ? 1_000_000 : 1);
