// Kiểm tra dữ liệu công ty và tin tuyển dụng do NTD gửi lên.
// Mỗi hàm trả { error } khi sai hoặc { value } (object đã làm sạch, chỉ gồm field được phép).
// FE (frontend/src/lib/validation/employer.ts) dùng cùng giới hạn: sửa ở đây thì sửa cả bên đó.
import { checkSkills, checkText, checkUrl } from './profileValidation.js';

export const EMPLOYER_LIMITS = {
  companyName: 100,
  companyDescription: 3000,
  shortText: 100, // ngành, danh mục, địa điểm
  address: 200,
  jobTitle: 150,
  jobText: 5000 // mô tả, yêu cầu, quyền lợi
};

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];
const EXPERIENCE_LEVELS = ['entry', 'junior', 'mid-level', 'senior', 'executive'];
const EDUCATION_LEVELS = ['high-school', 'associate', 'bachelor', 'master', 'phd', 'any'];
const CURRENCIES = ['VND', 'USD'];

// Chuỗi bắt buộc: có giá trị và không quá dài
const required = (value, label, max) => {
  const result = checkText(value, label, max);
  if (result.error) return result;
  if (!result.value) return { error: `Vui lòng nhập ${label.toLowerCase()}` };
  return result;
};

// Chạy lần lượt các bước kiểm tra, dừng ở lỗi đầu tiên
const collect = (checks) => {
  const value = {};
  for (const [key, result] of checks) {
    if (result.error) return { error: result.error };
    value[key] = result.value;
  }
  return { value };
};

// ===== Công ty =====

export const checkCompany = (body) => {
  const social = body.socialMedia ?? {};
  const currentYear = new Date().getFullYear();

  let foundedYear = { value: null };
  if (body.foundedYear !== undefined && body.foundedYear !== null && body.foundedYear !== '') {
    const year = Number(body.foundedYear);
    foundedYear = Number.isInteger(year) && year >= 1800 && year <= currentYear
      ? { value: year }
      : { error: `Năm thành lập phải từ 1800 đến ${currentYear}` };
  }

  const result = collect([
    ['name', required(body.name, 'Tên công ty', EMPLOYER_LIMITS.companyName)],
    ['description', required(body.description, 'Mô tả công ty', EMPLOYER_LIMITS.companyDescription)],
    ['industry', required(body.industry, 'Ngành nghề', EMPLOYER_LIMITS.shortText)],
    ['location', required(body.location, 'Địa chỉ', EMPLOYER_LIMITS.address)],
    ['website', checkUrl(body.website, 'Website')],
    ['foundedYear', foundedYear],
    ['facebook', checkUrl(social.facebook, 'Facebook')],
    ['linkedin', checkUrl(social.linkedin, 'LinkedIn')],
    ['twitter', checkUrl(social.twitter, 'Twitter')]
  ]);
  if (result.error) return result;

  const companySize = body.companySize || '1-10';
  if (!COMPANY_SIZES.includes(companySize)) return { error: 'Quy mô công ty không hợp lệ' };

  const { facebook, linkedin, twitter, ...rest } = result.value;
  return { value: { ...rest, companySize, socialMedia: { facebook, linkedin, twitter } } };
};

// ===== Tin tuyển dụng =====

const checkEnum = (value, list, label, fallback) => {
  if (value === undefined || value === null || value === '') return { value: fallback };
  return list.includes(value) ? { value } : { error: `${label} không hợp lệ` };
};

const checkMoney = (value, label) => {
  if (value === undefined || value === null || value === '') return { value: null };
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? { value: n } : { error: `${label} phải là số không âm` };
};

// Hạn nộp: ngày hợp lệ, không ở quá khứ. Tính hết ngày đó (23:59:59) để chọn "hôm nay" vẫn được.
const checkDeadline = (value) => {
  if (!value) return { error: 'Vui lòng chọn hạn nộp hồ sơ' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Hạn nộp hồ sơ không hợp lệ' };
  // Chỉ có ngày ("2030-01-01") thì đặt về cuối ngày theo giờ Việt Nam (UTC+7)
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setTime(Date.parse(`${value}T23:59:59+07:00`));
  if (date < new Date()) return { error: 'Hạn nộp hồ sơ phải từ hôm nay trở đi' };
  return { value: date };
};

// partial = true khi sửa tin: chỉ kiểm tra field có gửi lên.
// existing: tin hiện tại, để so lương tối thiểu/tối đa khi chỉ sửa một trong hai.
export const checkJob = (body, { partial = false, existing = null } = {}) => {
  const has = (key) => !partial || body[key] !== undefined;
  const checks = [];

  if (has('title')) checks.push(['title', required(body.title, 'Tiêu đề', EMPLOYER_LIMITS.jobTitle)]);
  if (has('description')) checks.push(['description', required(body.description, 'Mô tả công việc', EMPLOYER_LIMITS.jobText)]);
  if (has('requirements')) checks.push(['requirements', required(body.requirements, 'Yêu cầu', EMPLOYER_LIMITS.jobText)]);
  if (has('benefits')) checks.push(['benefits', required(body.benefits, 'Quyền lợi', EMPLOYER_LIMITS.jobText)]);
  if (has('location')) checks.push(['location', required(body.location, 'Địa điểm', EMPLOYER_LIMITS.shortText)]);
  if (has('category')) checks.push(['category', required(body.category, 'Ngành nghề', EMPLOYER_LIMITS.shortText)]);
  if (has('jobType')) checks.push(['jobType', checkEnum(body.jobType, JOB_TYPES, 'Hình thức làm việc', 'full-time')]);
  if (has('experienceLevel')) checks.push(['experienceLevel', checkEnum(body.experienceLevel, EXPERIENCE_LEVELS, 'Kinh nghiệm', 'mid-level')]);
  if (has('educationLevel')) checks.push(['educationLevel', checkEnum(body.educationLevel, EDUCATION_LEVELS, 'Học vấn', 'any')]);
  if (has('salaryCurrency')) checks.push(['salaryCurrency', checkEnum(body.salaryCurrency, CURRENCIES, 'Đơn vị tiền', 'VND')]);
  if (has('salaryMin')) checks.push(['salaryMin', checkMoney(body.salaryMin, 'Lương tối thiểu')]);
  if (has('salaryMax')) checks.push(['salaryMax', checkMoney(body.salaryMax, 'Lương tối đa')]);
  if (has('skills')) checks.push(['skills', checkSkills(body.skills ?? [])]);
  if (has('applicationDeadline')) {
    // Sửa tin mà giữ nguyên hạn nộp cũ (kể cả đã qua) thì không bắt đổi, ví dụ chỉ sửa lỗi chính tả
    const unchanged =
      existing?.applicationDeadline &&
      new Date(body.applicationDeadline).getTime() === new Date(existing.applicationDeadline).getTime();
    checks.push(['applicationDeadline', unchanged ? { value: existing.applicationDeadline } : checkDeadline(body.applicationDeadline)]);
  }
  if (has('showSalary')) checks.push(['showSalary', { value: body.showSalary === true || body.showSalary === 'true' }]);

  const result = collect(checks);
  if (result.error) return result;

  // So lương với giá trị sau khi sửa (giá trị mới nếu có gửi, không thì giá trị cũ)
  const pick = (key) => (key in result.value ? result.value[key] : existing?.[key]);
  const min = pick('salaryMin');
  const max = pick('salaryMax');
  if (min != null && max != null && min > max) return { error: 'Lương tối thiểu không được lớn hơn lương tối đa' };

  return result;
};
