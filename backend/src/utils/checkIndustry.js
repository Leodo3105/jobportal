// Ngành nghề của tin (Job.category) và công ty (Company.industry) phải là tên một danh mục
// loại "industry" đang hiện (active). Hai field này lưu TÊN ngành, không lưu id.
//
// Gọi SAU checkJob/checkCompany: `name` đã là chuỗi đã trim (không phải object như { $ne: null }).
// `current`: ngành đang lưu (khi sửa). Giữ nguyên ngành cũ thì không kiểm tra, kể cả khi admin
// đã ẩn ngành đó, để NTD vẫn sửa được các thông tin khác (giống cách giữ hạn nộp cũ đã qua).
import Category from '../models/category/Category.js';

const checkIndustry = async (name, current) => {
  if (current !== undefined && name === current) return { value: name };
  const exists = await Category.exists({ type: 'industry', active: true, name });
  return exists ? { value: name } : { error: 'Ngành nghề không có trong danh sách, vui lòng chọn lại' };
};

export default checkIndustry;
