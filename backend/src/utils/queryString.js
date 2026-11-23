// Đọc một tham số trên URL (req.query) dưới dạng chuỗi.
//
// Express 4 dùng thư viện `qs`, nên `?category[$ne]=x` được đọc thành object { $ne: 'x' }
// và `?skills[]=a&skills[]=b` thành mảng. Đưa thẳng vào truy vấn MongoDB thì object chứa
// toán tử ($ne, $gt...) bị hiểu là điều kiện (NoSQL injection), còn mảng làm .split() lỗi 500.
// Hàm này chỉ nhận chuỗi; mọi kiểu khác coi như không gửi.
const queryString = (value) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text === '' ? undefined : text;
};

export default queryString;
