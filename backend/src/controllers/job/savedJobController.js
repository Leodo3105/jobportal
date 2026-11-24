import SavedJob from '../../models/job/SavedJob.js';
import Job from '../../models/job/Job.js';

const SAVED_PAGE_SIZE = 12;
const MAX_LIMIT = 50;

// Field của tin cần để FE vẽ thẻ tin (JobCard) và biết tin còn mở hay không
const SAVED_JOB_FIELDS =
  'title location jobType experienceLevel skills salaryMin salaryMax salaryCurrency showSalary featured status applicationDeadline createdAt company';

const serverError = (res, error, context) => {
  console.error(`${context} error:`, error);
  return res.status(500).json({ success: false, error: 'Server Error' });
};

// Save a job
export const saveJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;

    // Tin nháp coi như không tồn tại (giống GET /api/jobs/:id). Tin đã đóng/hết hạn vẫn lưu được.
    const job = await Job.findById(jobId).select('status');
    if (!job || job.status === 'draft') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    const existingSave = await SavedJob.findOne({ user: req.user.id, job: jobId });
    if (existingSave) {
      return res.status(400).json({
        success: false,
        error: 'Tin tuyển dụng đã được lưu'
      });
    }

    const savedJob = await SavedJob.create({ user: req.user.id, job: jobId });

    res.status(201).json({
      success: true,
      data: savedJob,
      message: 'Tin tuyển dụng đã được lưu'
    });
  } catch (error) {
    // Bấm lưu 2 lần cùng lúc: cả hai qua được findOne, lần thứ hai vướng index unique (job, user)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Tin tuyển dụng đã được lưu' });
    }
    return serverError(res, error, 'Save job');
  }
};

// Unsave a job
export const unsaveJob = async (req, res) => {
  try {
    const result = await SavedJob.findOneAndDelete({
      user: req.user.id,
      job: req.params.jobId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Tin tuyển dụng chưa được lưu'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa tin tuyển dụng khỏi danh sách đã lưu'
    });
  } catch (error) {
    return serverError(res, error, 'Unsave job');
  }
};

// GET /api/saved-jobs?page=&limit=  danh sách việc đã lưu, mới lưu nhất ở trên
export const getSavedJobs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || SAVED_PAGE_SIZE, 1), MAX_LIMIT);

    // Ẩn tin đã bị NTD chuyển về nháp (không xoá bản lưu: tin mở lại thì hiện lại).
    // Lọc ngay trong truy vấn (không lọc sau khi lấy) để total và phân trang đúng.
    const savedIds = await SavedJob.find({ user: req.user.id }).distinct('job');
    const draftIds = await Job.find({ _id: { $in: savedIds }, status: 'draft' }).distinct('_id');
    const filter = { user: req.user.id, job: { $nin: draftIds } };

    const [savedJobs, total] = await Promise.all([
      SavedJob.find(filter)
        .populate({
          path: 'job',
          select: SAVED_JOB_FIELDS,
          populate: { path: 'company', select: 'name logo' }
        })
        // _id làm tiêu chí phụ: createdAt có thể trùng, sort không duy nhất làm phân trang lặp/sót tin
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SavedJob.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: savedJobs.length,
      total,
      totalPages: Math.ceil(total / limit),
      data: savedJobs
    });
  } catch (error) {
    return serverError(res, error, 'Get saved jobs');
  }
};

// GET /api/saved-jobs/ids  chỉ id các tin đã lưu, để FE tô nút "Lưu tin" trên các thẻ
export const getSavedJobIds = async (req, res) => {
  try {
    const ids = await SavedJob.find({ user: req.user.id }).distinct('job');
    res.status(200).json({ success: true, data: ids });
  } catch (error) {
    return serverError(res, error, 'Get saved job ids');
  }
};
