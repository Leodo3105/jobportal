// Đọc ?page= và ?limit= cho các API danh sách.
// page >= 1; 1 <= limit <= 50 (giới hạn để không ai lấy cả database trong một request).
// Giá trị không phải số (kể cả object như ?page[$gt]=1) thì dùng mặc định.
export const MAX_LIMIT = 50;

export const paging = (query, defaultLimit) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
};

// Phần chung của body trả về: số mục trong trang này, tổng số mục, tổng số trang
export const pageInfo = (count, total, limit) => ({ count, total, totalPages: Math.ceil(total / limit) });
