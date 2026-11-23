import User from '../../models/User.js';
import Job from '../../models/job/Job.js';
import Company from '../../models/employer/Company.js';
import Category from '../../models/category/Category.js';
import escapeRegex from '../../utils/escapeRegex.js';
import queryString from '../../utils/queryString.js';
import { deleteUserAccount } from '../../utils/deleteUserAccount.js';

// Các API chỉ dành cho admin (routes/admin/adminRoutes.js đã gắn protect + authorize('admin')).

const ROLES = ['jobseeker', 'employer', 'admin'];
const JOB_STATUSES = ['active', 'closed', 'draft', 'expired'];
const PLANS = ['free', 'basic', 'premium', 'enterprise'];
// Gói có quyền được hiện nổi bật (công ty và mọi tin của công ty)
const FEATURED_PLANS = ['premium', 'enterprise'];

// page >= 1, 1 <= limit <= 50
const paging = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const listResponse = (res, data, total, limit) =>
  res.status(200).json({ success: true, count: data.length, total, totalPages: Math.ceil(total / limit), data });

const serverError = (res, error, context) => {
  console.error(`${context} error:`, error);
  return res.status(500).json({ success: false, error: 'Server Error' });
};

// ===== Người dùng =====

// GET /api/admin/users?search=&role=&status=active|locked&page=
export const listUsers = async (req, res) => {
  try {
    const search = queryString(req.query.search);
    const role = queryString(req.query.role);
    const status = queryString(req.query.status);
    const query = {};

    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ name: pattern }, { email: pattern }];
    }
    if (role && ROLES.includes(role)) query.role = role;
    // Tài khoản cũ chưa có field isActive được coi là đang hoạt động
    if (status === 'active') query.isActive = { $ne: false };
    if (status === 'locked') query.isActive = false;

    const { page, limit, skip } = paging(req.query);
    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email role phone avatar isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return listResponse(res, users, total, limit);
  } catch (error) {
    return serverError(res, error, 'Admin list users');
  }
};

// PUT /api/admin/users/:id/status  body { isActive: boolean }
export const setUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Vui lòng gửi isActive là true hoặc false' });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Bạn không thể tự khoá tài khoản của mình' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }
    // Admin không khoá lẫn nhau: tránh một tài khoản admin bị chiếm khoá hết các admin khác
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Không thể khoá tài khoản quản trị viên' });
    }

    user.isActive = isActive;
    if (!isActive) {
      // Đăng xuất ngay mọi phiên của người bị khoá (protect cũng chặn isActive = false,
      // tăng tokenVersion để token cũ không dùng lại được kể cả khi mở khoá sau này)
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }
    await user.save();

    res.status(200).json({
      success: true,
      data: { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
      message: isActive ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản'
    });
  } catch (error) {
    return serverError(res, error, 'Admin set user status');
  }
};

// DELETE /api/admin/users/:id: xoá tài khoản kèm toàn bộ dữ liệu (hồ sơ, đơn, công ty, tin, file).
// Không hoàn tác được; muốn chặn tạm thời thì dùng khoá (PUT /users/:id/status).
export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Bạn không thể tự xoá tài khoản của mình ở đây' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }
    // Giống khoá: admin không xoá được admin khác
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Không thể xoá tài khoản quản trị viên' });
    }

    const deleted = await deleteUserAccount(user);

    res.status(200).json({
      success: true,
      data: { _id: user._id, email: user.email, deleted },
      message: `Đã xoá tài khoản ${user.email}`
    });
  } catch (error) {
    return serverError(res, error, 'Admin delete user');
  }
};

// ===== Tin tuyển dụng =====

// GET /api/admin/jobs?search=&status=&page=  (mọi trạng thái, kể cả nháp)
export const listJobs = async (req, res) => {
  try {
    const search = queryString(req.query.search);
    const status = queryString(req.query.status);
    const query = {};

    if (search) query.title = { $regex: escapeRegex(search), $options: 'i' };
    if (status && JOB_STATUSES.includes(status)) query.status = status;

    const { page, limit, skip } = paging(req.query);
    const [jobs, total] = await Promise.all([
      Job.find(query)
        .select('title location status featured applicationDeadline views createdAt company user')
        .populate({ path: 'company', select: 'name logo' })
        .populate({ path: 'user', select: 'name email' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query)
    ]);

    return listResponse(res, jobs, total, limit);
  } catch (error) {
    return serverError(res, error, 'Admin list jobs');
  }
};

// PUT /api/admin/jobs/:id/featured  body { featured: boolean }
export const setJobFeatured = async (req, res) => {
  try {
    const { featured } = req.body;
    if (typeof featured !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Vui lòng gửi featured là true hoặc false' });
    }

    const job = await Job.findByIdAndUpdate(req.params.id, { featured }, { new: true }).select('title featured');
    if (!job) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tin tuyển dụng' });
    }

    res.status(200).json({
      success: true,
      data: job,
      message: featured ? 'Đã đánh dấu tin nổi bật' : 'Đã bỏ đánh dấu nổi bật'
    });
  } catch (error) {
    return serverError(res, error, 'Admin set job featured');
  }
};

// ===== Công ty và gói dịch vụ =====

// GET /api/admin/companies?search=&plan=&page=  (có gói dịch vụ và chủ tài khoản: chỉ admin thấy)
export const listCompanies = async (req, res) => {
  try {
    const search = queryString(req.query.search);
    const plan = queryString(req.query.plan);
    const query = {};

    if (search) query.name = { $regex: escapeRegex(search), $options: 'i' };
    if (plan && PLANS.includes(plan)) query['subscription.type'] = plan;

    const { page, limit, skip } = paging(req.query);
    const [companies, total] = await Promise.all([
      Company.find(query)
        .select('name logo industry location featured subscription user createdAt')
        .populate({ path: 'user', select: 'name email isActive' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(query)
    ]);

    // Số tin (mọi trạng thái) của từng công ty
    const counts = await Job.aggregate([
      { $match: { company: { $in: companies.map((c) => c._id) } } },
      { $group: { _id: '$company', n: { $sum: 1 } } }
    ]);
    const byCompany = new Map(counts.map((row) => [row._id.toString(), row.n]));
    for (const company of companies) company.jobCount = byCompany.get(company._id.toString()) ?? 0;

    return listResponse(res, companies, total, limit);
  } catch (error) {
    return serverError(res, error, 'Admin list companies');
  }
};

// PUT /api/admin/companies/:id/subscription  body { type, endDate }
// Gói premium/enterprise: công ty và mọi tin của công ty được featured = true; gói khác thì bỏ.
export const setCompanySubscription = async (req, res) => {
  try {
    const { type, endDate } = req.body;
    if (!PLANS.includes(type)) {
      return res.status(400).json({ success: false, error: 'Gói dịch vụ không hợp lệ' });
    }

    // Gói trả phí phải có ngày hết hạn ở tương lai; gói free không cần
    let end = null;
    if (type !== 'free') {
      end = new Date(endDate);
      if (!endDate || Number.isNaN(end.getTime())) {
        return res.status(400).json({ success: false, error: 'Vui lòng chọn ngày hết hạn gói' });
      }
      if (end < new Date()) {
        return res.status(400).json({ success: false, error: 'Ngày hết hạn gói phải ở tương lai' });
      }
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    const featured = FEATURED_PLANS.includes(type);
    company.subscription = {
      type,
      startDate: new Date(),
      endDate: end ?? undefined,
      status: 'active'
    };
    company.featured = featured;
    await company.save();
    // Tin của công ty đi theo gói
    await Job.updateMany({ company: company._id }, { featured });

    res.status(200).json({
      success: true,
      data: { _id: company._id, name: company.name, featured: company.featured, subscription: company.subscription },
      message: 'Đã cập nhật gói dịch vụ'
    });
  } catch (error) {
    return serverError(res, error, 'Admin set subscription');
  }
};

// ===== Danh mục =====

// GET /api/admin/categories?type=  Mọi danh mục (kể cả đang ẩn), ngành kèm số tin/công ty đang dùng.
// Tạo/sửa/xoá dùng route có sẵn /api/categories (đã giới hạn cho admin).
export const listCategories = async (req, res) => {
  try {
    const type = queryString(req.query.type);
    const query = type ? { type } : {};
    const categories = await Category.find(query).sort({ type: 1, name: 1 }).lean();

    // Đếm một lần cho mọi ngành thay vì từng ngành một
    const [jobRows, companyRows] = await Promise.all([
      Job.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
      Company.aggregate([{ $group: { _id: '$industry', n: { $sum: 1 } } }])
    ]);
    const jobsByName = new Map(jobRows.map((row) => [row._id, row.n]));
    const companiesByName = new Map(companyRows.map((row) => [row._id, row.n]));

    for (const category of categories) {
      if (category.type === 'industry') {
        category.jobCount = jobsByName.get(category.name) ?? 0;
        category.companyCount = companiesByName.get(category.name) ?? 0;
      }
    }

    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    return serverError(res, error, 'Admin list categories');
  }
};
