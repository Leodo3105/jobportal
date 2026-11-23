// src/controllers/category/categoryController.js
import Category from '../../models/category/Category.js';
import slugify from 'slugify';
import escapeRegex from '../../utils/escapeRegex.js';
import queryString from '../../utils/queryString.js';
import Job from '../../models/job/Job.js';
import Company from '../../models/employer/Company.js';

const TYPES = ['industry', 'skill', 'position', 'location'];
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

// Kiểm tra name/description/type gửi lên. Trả câu lỗi hoặc null.
// (name là object thì name.trim() làm lỗi 500, nên kiểm tra kiểu trước)
const checkFields = ({ name, description, type }, { requireName }) => {
  if (name !== undefined || requireName) {
    if (typeof name !== 'string' || !name.trim()) return 'Vui lòng nhập tên danh mục';
    if (name.trim().length > MAX_NAME) return `Tên danh mục tối đa ${MAX_NAME} ký tự`;
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') return 'Mô tả không hợp lệ';
    if (description.trim().length > MAX_DESCRIPTION) return `Mô tả tối đa ${MAX_DESCRIPTION} ký tự`;
  }
  if (type !== undefined && !TYPES.includes(type)) return 'Loại danh mục không hợp lệ';
  return null;
};

// Tin và công ty lưu TÊN ngành (chuỗi), không lưu id. Đếm số nơi đang dùng một ngành.
export const countIndustryUsage = async (name) => {
  const [jobs, companies] = await Promise.all([
    Job.countDocuments({ category: name }),
    Company.countDocuments({ industry: name })
  ]);
  return { jobs, companies };
};

// Category names are unique across all types (unique index on name),
// compared case-insensitively
const findByName = (name, excludeId) =>
  Category.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') },
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });

const duplicateResponse = (res) =>
  res.status(400).json({
    success: false,
    error: 'Tên danh mục đã tồn tại'
  });

// Create a new category
export const createCategory = async (req, res) => {
  try {
    const { name, type, description, icon } = req.body;
    
    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ thông tin: tên và loại danh mục'
      });
    }
    const fieldError = checkFields({ name, description, type }, { requireName: true });
    if (fieldError) {
      return res.status(400).json({ success: false, error: fieldError });
    }
    
    // Check if a category with this name already exists (any type)
    if (await findByName(name)) {
      return duplicateResponse(res);
    }
    
    // Create slug from name
    const slug = slugify(name, {
      lower: true,
      strict: true
    });
    
    // Create category
    const category = await Category.create({
      name: name.trim(),
      type,
      slug,
      description: description || '',
      icon: icon || '',
      active: true
    });
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Đã tạo danh mục mới'
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return duplicateResponse(res);
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(error.errors).map((e) => e.message).join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get all categories
export const getCategories = async (req, res) => {
  try {
    // Build query
    let query = {};
    
    // Filter by type if provided
    if (req.params.type) {
      query.type = req.params.type;
    }
    
    // Filter by active status
    if (req.query.active === 'true') {
      query.active = true;
    } else if (req.query.active === 'false') {
      query.active = false;
    }
    
    // Search by name
    const search = queryString(req.query.search);
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }
    
    // Get categories
    const categories = await Category.find(query).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy danh mục'
      });
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category by id error:', error);
    
    // Check if error is due to invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy danh mục'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { name, description, icon, active } = req.body;
    
    // Find the category
    let category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy danh mục'
      });
    }
    
    const fieldError = checkFields({ name, description }, { requireName: false });
    if (fieldError) {
      return res.status(400).json({ success: false, error: fieldError });
    }
    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active phải là true hoặc false' });
    }

    const oldName = category.name;

    // Update fields
    if (name !== undefined && name.trim() !== oldName) {
      if (await findByName(name, category._id)) {
        return duplicateResponse(res);
      }
      category.name = name.trim();
      
      // Update slug if name is changed
      category.slug = slugify(name, {
        lower: true,
        strict: true
      });
    }
    
    if (description !== undefined) {
      category.description = description;
    }
    
    if (icon !== undefined) {
      category.icon = icon;
    }
    
    if (active !== undefined) {
      category.active = active;
    }
    
    // Save the updated category
    await category.save();

    // Tin và công ty lưu tên ngành dạng chuỗi: đổi tên ngành thì đổi theo,
    // nếu không lọc theo ngành mới sẽ không ra tin cũ
    let renamed = null;
    if (category.type === 'industry' && category.name !== oldName) {
      const [jobs, companies] = await Promise.all([
        Job.updateMany({ category: oldName }, { category: category.name }),
        Company.updateMany({ industry: oldName }, { industry: category.name })
      ]);
      renamed = { jobs: jobs.modifiedCount, companies: companies.modifiedCount };
    }
    
    res.status(200).json({
      success: true,
      data: category,
      renamed, // số tin/công ty được đổi theo tên ngành mới (null nếu không đổi tên)
      message: 'Đã cập nhật danh mục'
    });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === 11000) {
      return duplicateResponse(res);
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(error.errors).map((e) => e.message).join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy danh mục'
      });
    }
    
    // Ngành đang có tin/công ty dùng thì không xoá (dữ liệu sẽ trỏ tới ngành không còn tồn tại)
    if (category.type === 'industry') {
      const usage = await countIndustryUsage(category.name);
      if (usage.jobs || usage.companies) {
        return res.status(400).json({
          success: false,
          error: `Ngành này đang được dùng bởi ${usage.jobs} tin và ${usage.companies} công ty. Hãy ẩn ngành thay vì xoá.`
        });
      }
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Đã xóa danh mục'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};