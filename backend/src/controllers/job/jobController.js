import mongoose from 'mongoose';
import Application from '../../models/job/Application.js';
import SavedJob from '../../models/job/SavedJob.js';
import JobseekerProfile from '../../models/jobseeker/Profile.js';
import { CV_DIR, removeUploadFile } from '../../config/paths.js';
import Job from '../../models/job/Job.js';
import Company from '../../models/employer/Company.js';
import escapeRegex from '../../utils/escapeRegex.js';
import queryString from '../../utils/queryString.js';
import { checkJob } from '../../utils/employerValidation.js';

// Fields an employer may set when creating/updating a job.
// Anything else (featured, views, user, company, status...) is ignored.
const EDITABLE_JOB_FIELDS = [
  'title',
  'description',
  'requirements',
  'benefits',
  'location',
  'jobType',
  'category',
  'skills',
  'experienceLevel',
  'educationLevel',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'showSalary',
  'applicationDeadline'
];

const pickJobFields = (body) =>
  Object.fromEntries(EDITABLE_JOB_FIELDS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

// Jobs that are still open for applications (deadline not passed)
const openDeadline = () => ({ $gte: new Date() });


// Create a new job
export const createJob = async (req, res) => {
  try {
    // Find the company associated with the employer
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Bạn cần tạo hồ sơ công ty trước khi đăng tin tuyển dụng'
      });
    }

    // Kiểm tra và làm sạch dữ liệu (chỉ lấy field được phép, xem utils/employerValidation.js)
    const result = checkJob(req.body);
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const job = await Job.create({
      ...result.value,
      user: req.user.id,
      company: company._id
    });

    res.status(201).json({
      success: true,
      data: job,
      message: 'Tin tuyển dụng đã được tạo thành công'
    });
  } catch (error) {
    console.error('Create job error:', error);
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

// Get all jobs with pagination and filters
export const getJobs = async (req, res) => {
  try {
    // Build query
    let query = {};
    
    // Public listing only shows active jobs (employers see their drafts/closed
    // jobs via /api/jobs/employer/myjobs)
    query.status = 'active';
    query.applicationDeadline = openDeadline();
    
    // Mọi tham số đọc qua queryString(): chỉ nhận chuỗi (chống `?category[$ne]=x`)
    const category = queryString(req.query.category);
    const jobType = queryString(req.query.jobType);
    const location = queryString(req.query.location);
    const experienceLevel = queryString(req.query.experienceLevel);
    const salary = queryString(req.query.salary);
    const keyword = queryString(req.query.keyword);
    const skills = queryString(req.query.skills);
    const company = queryString(req.query.company);

    if (category) query.category = category;
    if (jobType) query.jobType = jobType;
    if (experienceLevel) query.experienceLevel = experienceLevel;

    if (location) {
      query.location = { $regex: escapeRegex(location), $options: 'i' };
    }

    // Filter by salary range
    if (salary && Number.isFinite(Number(salary))) {
      query.salaryMin = { $lte: Number(salary) };
      query.salaryMax = { $gte: Number(salary) };
    }

    // Search by keyword in title, description, requirements or skills
    if (keyword) {
      query.$text = { $search: keyword };
    }

    // Filter by skills ("React, Node")
    if (skills) {
      query.skills = { $in: skills.split(',').map((skill) => skill.trim()).filter(Boolean) };
    }

    // Tin của một công ty (trang /companies/[id])
    if (company) {
      if (!mongoose.isValidObjectId(company)) {
        return res.status(400).json({ success: false, error: 'Mã công ty không hợp lệ' });
      }
      query.company = company;
    }

    // Pagination
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Job.countDocuments(query);

    // Execute query
    const jobs = await Job.find(query)
      .populate({
        path: 'company',
        select: 'name logo location industry'
      })
      .sort({ featured: -1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

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
      count: jobs.length,
      pagination,
      totalPages: Math.ceil(total / limit),
      data: jobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get single job
export const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate({
        path: 'company',
        select: 'name description logo location industry website companySize'
      });

    // Tin nháp chưa công khai: trả 404 giống như không tồn tại
    if (!job || job.status === 'draft') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    // Chỉ tính lượt xem cho tin đang mở (active và còn hạn).
    // Dùng $inc để cộng ngay trong MongoDB, tránh 2 request cùng lúc ghi đè nhau.
    if (job.status === 'active' && job.applicationDeadline >= new Date()) {
      await Job.updateOne({ _id: job._id }, { $inc: { views: 1 } });
      job.views += 1; // để response trả về số lượt xem mới
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Get job error:', error);
    
    // Check if error is due to invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Update job
export const updateJob = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    // Make sure user is job owner
    if (job.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật tin tuyển dụng này'
      });
    }

    // Chỉ field được phép mới được sửa (featured, views, status... bị bỏ qua).
    // partial: chỉ kiểm tra field có gửi lên; existing: để so lương min/max và giữ hạn nộp cũ.
    const result = checkJob(pickJobFields(req.body), { partial: true, existing: job });
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    const updates = result.value;

    // Gia hạn tin đã hết hạn (tác vụ định kỳ đặt "expired") thì tự mở lại.
    // status vẫn không nhận từ body; server tự đặt. Gửi lại đúng hạn cũ (đã qua) thì tin giữ "expired".
    const reopened =
      job.status === 'expired' &&
      updates.applicationDeadline &&
      new Date(updates.applicationDeadline) > new Date();
    if (reopened) updates.status = 'active';

    // Update job
    job = await Job.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: job,
      message: reopened ? 'Đã gia hạn và mở lại tin tuyển dụng' : 'Tin tuyển dụng đã được cập nhật'
    });
  } catch (error) {
    console.error('Update job error:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: error.name === 'ValidationError'
          ? Object.values(error.errors).map((e) => e.message).join(', ')
          : `Giá trị không hợp lệ cho trường ${error.path}`
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Delete job
export const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    // Make sure user is job owner or admin
    if (job.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa tin tuyển dụng này'
      });
    }

    // Xoá kèm dữ liệu phụ thuộc, nếu không đơn ứng tuyển trỏ tới một tin không còn tồn tại
    const applications = await Application.find({ job: job._id }).select('attachedCV');
    await Application.deleteMany({ job: job._id });
    await SavedJob.deleteMany({ job: job._id });
    await job.deleteOne();

    // File CV chỉ xoá khi không còn đơn nào khác hay hồ sơ nào dùng
    for (const file of new Set(applications.map((a) => a.attachedCV).filter(Boolean))) {
      const stillUsed =
        (await Application.exists({ attachedCV: file })) || (await JobseekerProfile.exists({ cvFile: file }));
      if (!stillUsed) removeUploadFile(CV_DIR, file);
    }

    res.status(200).json({
      success: true,
      message: 'Tin tuyển dụng đã được xóa'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get jobs by employer
export const getEmployerJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean(); // object JS thường, để gắn thêm field đếm đơn

    // Đếm đơn của các tin này theo (tin, trạng thái) trong một lần truy vấn
    const counts = await Application.aggregate([
      { $match: { job: { $in: jobs.map((job) => job._id) } } },
      { $group: { _id: { job: '$job', status: '$status' }, n: { $sum: 1 } } }
    ]);

    for (const job of jobs) {
      const mine = counts.filter((c) => c._id.job.equals(job._id));
      const by = (status) => mine.find((c) => c._id.status === status)?.n ?? 0;
      job.applicationCount = mine.filter((c) => c._id.status !== 'withdrawn').reduce((sum, c) => sum + c.n, 0);
      job.pendingCount = by('pending'); // đơn NTD chưa mở
    }

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    console.error('Get employer jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Change job status
export const changeJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'closed', 'draft', 'expired'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp trạng thái hợp lệ'
      });
    }
    
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    // Make sure user is job owner
    if (job.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật tin tuyển dụng này'
      });
    }

    // Mở lại tin đã quá hạn nộp thì tin "active" nhưng không hiện ở đâu cả
    if (status === 'active' && new Date(job.applicationDeadline) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Hạn nộp hồ sơ đã qua. Hãy sửa hạn nộp trước khi mở lại tin.'
      });
    }

    // Update job status
    job.status = status;
    await job.save();

    res.status(200).json({
      success: true,
      data: job,
      message: 'Đã cập nhật trạng thái tin tuyển dụng'
    });
  } catch (error) {
    console.error('Change job status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get similar jobs
export const getSimilarJobs = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job || job.status === 'draft') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    // Find similar jobs based on category and skills
    const similarJobs = await Job.find({
      _id: { $ne: job._id }, // Exclude current job
      status: 'active',
      applicationDeadline: openDeadline(),
      $or: [
        { category: job.category },
        { skills: { $in: job.skills } }
      ]
    })
    .limit(5)
    .populate({
      path: 'company',
      select: 'name logo'
    });

    res.status(200).json({
      success: true,
      count: similarJobs.length,
      data: similarJobs
    });
  } catch (error) {
    console.error('Get similar jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};
