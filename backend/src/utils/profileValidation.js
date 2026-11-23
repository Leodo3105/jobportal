// Kiểm tra dữ liệu hồ sơ ứng viên. Mỗi hàm trả { error } khi sai, hoặc { value } khi đúng.
// FE (frontend/src/lib/validation/profile.ts) dùng cùng các giới hạn này: sửa ở đây thì sửa cả bên đó.

export const LIMITS = {
  title: 100,
  shortText: 100, // vị trí mong muốn, địa điểm, tên trường, tên công ty...
  bio: 2000,
  description: 1000, // mô tả một mục học vấn/kinh nghiệm
  skills: 30, // số kỹ năng tối đa
  skill: 50, // độ dài một kỹ năng
  url: 300
};

// Chỉ nhận link http/https. Link này hiện cho NTD bấm vào, nên phải chặn
// "javascript:alert(1)" (bấm vào là chạy mã trong trình duyệt của NTD).
export const checkUrl = (value, label) => {
  if (value === undefined || value === null || value === '') return { value: '' };
  if (typeof value !== 'string') return { error: `${label} không hợp lệ` };
  const url = value.trim();
  if (url.length > LIMITS.url) return { error: `${label} tối đa ${LIMITS.url} ký tự` };
  if (!/^https?:\/\/\S+$/i.test(url)) return { error: `${label} phải bắt đầu bằng http:// hoặc https://` };
  return { value: url };
};

// Nhận mảng hoặc chuỗi "React, Node.js". Bỏ ô trống và kỹ năng trùng (không phân biệt hoa thường).
export const checkSkills = (skills) => {
  const list = Array.isArray(skills) ? skills : String(skills ?? '').split(',');
  const seen = new Set();
  const result = [];

  for (const item of list) {
    if (typeof item !== 'string') return { error: 'Kỹ năng không hợp lệ' };
    const skill = item.trim();
    if (!skill || seen.has(skill.toLowerCase())) continue;
    if (skill.length > LIMITS.skill) return { error: `Mỗi kỹ năng tối đa ${LIMITS.skill} ký tự` };
    seen.add(skill.toLowerCase());
    result.push(skill);
  }

  if (result.length > LIMITS.skills) return { error: `Tối đa ${LIMITS.skills} kỹ năng` };
  return { value: result };
};

// Chuỗi không bắt buộc, có giới hạn độ dài
export const checkText = (value, label, max) => {
  if (value === undefined || value === null) return { value: '' };
  if (typeof value !== 'string') return { error: `${label} không hợp lệ` };
  const text = value.trim();
  if (text.length > max) return { error: `${label} tối đa ${max} ký tự` };
  return { value: text };
};

const toDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date; // undefined = sai định dạng
};

// Khoảng thời gian của một mục học vấn/kinh nghiệm.
// current = true (đang học/đang làm) thì bỏ ngày kết thúc.
export const checkPeriod = ({ from, to, current }) => {
  const fromDate = toDate(from);
  if (!fromDate) return { error: 'Vui lòng nhập ngày bắt đầu hợp lệ' };
  if (fromDate > new Date()) return { error: 'Ngày bắt đầu không được ở tương lai' };

  const isCurrent = current === true || current === 'true';
  if (isCurrent) return { value: { from: fromDate, to: undefined, current: true } };

  const toValue = toDate(to);
  if (toValue === undefined) return { error: 'Ngày kết thúc không hợp lệ' };
  if (toValue === null) return { error: 'Vui lòng nhập ngày kết thúc, hoặc đánh dấu là vẫn đang ở đây' };
  if (toValue < fromDate) return { error: 'Ngày kết thúc phải sau ngày bắt đầu' };
  return { value: { from: fromDate, to: toValue, current: false } };
};
