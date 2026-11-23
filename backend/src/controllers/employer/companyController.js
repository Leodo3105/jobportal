import Company from '../../models/employer/Company.js';
import { checkCompany } from '../../utils/employerValidation.js';
import escapeRegex from '../../utils/escapeRegex.js';
import queryString from '../../utils/queryString.js';
import User from '../../models/User.js';
import Job from '../../models/job/Job.js';
import Application from '../../models/job/Application.js';
import fs from 'fs';
import {
  LOGO_DIR,
  DEFAULT_LOGO,
  resolveUploadFile,
  removeUploadFile
} from '../../config/paths.js';

// Get current employer company profile
export const getCompanyProfile = async (req, res) => {
  try {
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Chưa có thông tin công ty cho người dùng này'
      });
    }

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Create or update company profile.
// Ghi đè toàn bộ thông tin công ty (field không gửi về rỗng/mặc định). Logo có API riêng.
// `featured` và `subscription` KHÔNG nhận từ body: chỉ admin quản lý.
export const createOrUpdateCompany = async (req, res) => {
  try {
    const result = checkCompany(req.body);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    const companyFields = { ...result.value, user: req.user.id };

    let company = await Company.findOne({ user: req.user.id });

    if (company) {
      // runValidators: không có thì findOneAndUpdate bỏ qua required/enum của schema
      company = await Company.findOneAndUpdate(
        { user: req.user.id },
        { $set: companyFields },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        data: company,
        message: 'Thông tin công ty đã được cập nhật'
      });
    }

    company = await Company.create(companyFields);

    res.status(201).json({
      success: true,
      data: company,
      message: 'Thông tin công ty đã được tạo'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: 'Thông tin công ty không hợp lệ' });
    }
    console.error('Create company error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Field công ty được phép công khai. KHÔNG gồm `user` (id tài khoản NTD)
// và `subscription` (gói dịch vụ đã mua): đó là thông tin nội bộ.
const PUBLIC_COMPANY_FIELDS = 'name description website industry companySize location logo foundedYear socialMedia featured';

// Đếm số tin đang tuyển (active, còn hạn) của từng công ty, trả Map<companyId, số tin>
const countOpenJobs = async (companyIds) => {
  const rows = await Job.aggregate([
    { $match: { company: { $in: companyIds }, status: 'active', applicationDeadline: { $gte: new Date() } } },
    { $group: { _id: '$company', n: { $sum: 1 } } }
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.n]));
};

// Get all companies
export const getAllCompanies = async (req, res) => {
  try {
    // Build query
    let query = {};
    
    // Filter by featured
    if (req.query.featured === 'true') {
      query.featured = true;
    }
    
    // Chỉ nhận chuỗi (chống `?industry[$ne]=x`), xem utils/queryString.js
    const industry = queryString(req.query.industry);
    const location = queryString(req.query.location);
    const search = queryString(req.query.search);

    if (industry) query.industry = industry;

    if (location) {
      query.location = { $regex: escapeRegex(location), $options: 'i' };
    }

    // Search by name
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }

    // Pagination
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Company.countDocuments(query);

    // Execute query
    const companies = await Company.find(query)
      .select(PUBLIC_COMPANY_FIELDS)
      .sort({ featured: -1, name: 1 })
      .skip(startIndex)
      .limit(limit)
      .lean(); // object thường để gắn thêm openJobCount

    const openJobs = await countOpenJobs(companies.map((c) => c._id));
    for (const company of companies) {
      company.openJobCount = openJobs.get(company._id.toString()) ?? 0;
    }

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: companies.length,
      total,
      pagination,
      totalPages: Math.ceil(total / limit),
      data: companies
    });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get company by ID
export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select(PUBLIC_COMPANY_FIELDS).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin công ty'
      });
    }

    const openJobs = await countOpenJobs([company._id]);
    company.openJobCount = openJobs.get(company._id.toString()) ?? 0;

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Get company by id error:', error);
    
    // Check if error is due to invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin công ty'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Upload company logo
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng upload file ảnh'
      });
    }

    // Find the company
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      // Multer đã lưu file trước khi hàm này chạy: xoá để không để lại file rác
      removeUploadFile(LOGO_DIR, req.file.filename);
      return res.status(404).json({
        success: false,
        error: 'Bạn cần lưu thông tin công ty trước khi tải logo'
      });
    }

    // Delete old logo if it's not the default
    if (company.logo !== DEFAULT_LOGO) {
      removeUploadFile(LOGO_DIR, company.logo);
    }

    // Update logo
    company.logo = req.file.filename;
    await company.save();

    res.status(200).json({
      success: true,
      data: {
        logo: req.file.filename,
        logoUrl: `/uploads/logos/${req.file.filename}`
      },
      message: 'Logo đã được cập nhật'
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get company logo
export const getCompanyLogo = async (req, res) => {
  try {
    const filename = req.params.filename;
    
    const logoPath = resolveUploadFile(LOGO_DIR, filename);
    
    if (!logoPath || !fs.existsSync(logoPath)) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy logo'
      });
    }
    
    res.sendFile(logoPath);
  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get company stats (employer)
export const getCompanyStats = async (req, res) => {
  try {
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin công ty'
      });
    }

    // Job counts by status
    const jobs = await Job.find({ company: company._id }).select('_id status');
    const jobIds = jobs.map((job) => job._id);
    const activeJobCount = jobs.filter((job) => job.status === 'active').length;

    // Application counts by status in a single query
    const grouped = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byStatus = Object.fromEntries(grouped.map((g) => [g._id, g.count]));
    const countOf = (status) => byStatus[status] || 0;

    res.status(200).json({
      success: true,
      data: {
        jobStats: {
          total: jobs.length,
          active: activeJobCount,
          closed: jobs.length - activeJobCount
        },
        applicationStats: {
          total: grouped.reduce((sum, g) => sum + g.count, 0),
          pending: countOf('pending'),
          viewed: countOf('viewed'),
          interview: countOf('interview'),
          accepted: countOf('accepted'),
          rejected: countOf('rejected'),
          withdrawn: countOf('withdrawn')
        }
      }
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Update company subscription
export const updateSubscription = async (req, res) => {
  try {
    const { type, startDate, endDate, status } = req.body;
    
    if (!type || !['free', 'basic', 'premium', 'enterprise'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp loại gói dịch vụ hợp lệ'
      });
    }
    
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin công ty'
      });
    }

    // Update subscription
    company.subscription = {
      type,
      startDate: startDate || new Date(),
      endDate: endDate || (() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      })(),
      status: status || 'active'
    };
    
    await company.save();

    res.status(200).json({
      success: true,
      data: company,
      message: 'Gói dịch vụ đã được cập nhật'
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};