import mongoose from 'mongoose';
import Application from '../../models/job/Application.js';
import Job from '../../models/job/Job.js';
import JobseekerProfile from '../../models/jobseeker/Profile.js';
import Notification from '../../models/notification/Notification.js';
import fs from 'fs';
import { CV_DIR, resolveUploadFile, removeUploadFile } from '../../config/paths.js';
import queryString from '../../utils/queryString.js';
import { paging, pageInfo } from '../../utils/pagination.js';

// Số mục mỗi trang mặc định (FE có thể gửi ?limit=, tối đa 50)
const MY_APPLICATIONS_PAGE_SIZE = 10;
const JOB_APPLICATIONS_PAGE_SIZE = 20;
const APPLICATION_STATUSES = ['pending', 'viewed', 'interview', 'accepted', 'rejected', 'withdrawn'];

// Giới hạn độ dài các nội dung NTD nhập
const MAX_FEEDBACK = 1000;
const MAX_NOTE = 1000;
const INTERVIEW_TYPES = ['in-person', 'phone', 'video'];

// Tên trạng thái bằng tiếng Việt cho nội dung thông báo gửi ứng viên
const STATUS_LABELS = {
  pending: 'đang chờ xem',
  viewed: 'nhà tuyển dụng đã xem',
  interview: 'được mời phỏng vấn',
  accepted: 'được nhận',
  rejected: 'chưa phù hợp'
};

// Giờ Việt Nam, không phụ thuộc múi giờ của máy chủ: "16:00 10/01/2030"
const formatVnDateTime = (date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);

// Statuses from which a jobseeker may still withdraw
const WITHDRAWABLE_STATUSES = ['pending', 'viewed', 'interview'];

// `notes` là ghi chú nội bộ của nhà tuyển dụng (chỉ NTD/admin thêm được), ứng viên không được thấy.
// Lịch phỏng vấn (`interviews`) và `employerFeedback` thì gửi cho ứng viên bình thường.
const withoutPrivateNotes = (application) => {
  const data = application.toObject();
  delete data.notes;
  return data;
};

const withdrawnError = (res) =>
  res.status(400).json({
    success: false,
    error: 'Ứng viên đã rút đơn này'
  });

// Giới hạn độ dài thư giới thiệu (FE cũng kiểm tra con số này)
const MAX_COVER_LETTER = 2000;

// Apply for a job
export const applyForJob = async (req, res) => {
  // Multer đã lưu file CV (nếu có) xuống đĩa TRƯỚC khi hàm này chạy.
  // Nên mọi nhánh trả lỗi phải xoá file đó, nếu không thư mục uploads/cv đầy file rác.
  const uploadedCV = req.file?.filename;
  let application; // khi đã lưu đơn thì file thuộc về đơn, không được xoá nữa
  const fail = (status, error) => {
    if (uploadedCV && !application) removeUploadFile(CV_DIR, uploadedCV);
    return res.status(status).json({ success: false, error });
  };

  try {
    const { jobId } = req.body;
    const coverLetter = (req.body.coverLetter || '').trim();

    if (!jobId) {
      return fail(400, 'Vui lòng cung cấp ID của công việc');
    }

    // Không kiểm tra thì findById("abc") ném CastError và trả 500
    if (!mongoose.isValidObjectId(jobId)) {
      return fail(400, 'ID công việc không hợp lệ');
    }

    if (coverLetter.length > MAX_COVER_LETTER) {
      return fail(400, `Thư giới thiệu tối đa ${MAX_COVER_LETTER} ký tự`);
    }

    // Check if job exists and is active
    const job = await Job.findById(jobId).populate('company user');

    if (!job) {
      return fail(404, 'Không tìm thấy tin tuyển dụng');
    }

    if (job.status !== 'active') {
      return fail(400, 'Tin tuyển dụng này không còn nhận hồ sơ');
    }

    if (new Date(job.applicationDeadline) < new Date()) {
      return fail(400, 'Đã hết hạn nộp hồ sơ cho tin tuyển dụng này');
    }

    // Check if user already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      user: req.user.id
    });

    // A withdrawn application can be re-submitted (reactivated below);
    // any other existing application blocks a new one
    if (existingApplication && existingApplication.status !== 'withdrawn') {
      return fail(400, 'Bạn đã ứng tuyển vào vị trí này');
    }

    // Không gửi file mới thì phải có CV trong hồ sơ
    let profile = await JobseekerProfile.findOne({ user: req.user.id });

    if (!uploadedCV && !profile?.cvFile) {
      return fail(400, 'Bạn cần tải lên CV trước khi ứng tuyển');
    }

    // Gửi file mới nhưng chưa có hồ sơ: tạo hồ sơ cơ bản (giống PUT /api/cv/upload).
    // File mới chỉ gắn vào đơn này, không đặt làm CV của hồ sơ.
    if (!profile) {
      profile = await JobseekerProfile.create({
        user: req.user.id,
        title: `Hồ sơ của ${req.user.name}`
      });
    }

    const attachedCV = uploadedCV || profile.cvFile;

    if (existingApplication) {
      // Reactivate the withdrawn application as a fresh submission
      const previousCV = existingApplication.attachedCV;

      existingApplication.set({
        profile: profile._id,
        coverLetter,
        attachedCV,
        status: 'pending',
        notes: [],
        interviews: [],
        employerFeedback: undefined
      });
      application = await existingApplication.save();

      // Clean up the previously attached CV if nothing uses it any more
      if (previousCV && previousCV !== attachedCV) {
        const stillUsed =
          (await Application.exists({ attachedCV: previousCV })) ||
          (await JobseekerProfile.exists({ cvFile: previousCV }));
        if (!stillUsed) removeUploadFile(CV_DIR, previousCV);
      }
    } else {
      application = await Application.create({
        job: jobId,
        user: req.user.id,
        profile: profile._id,
        coverLetter,
        attachedCV
      });
    }

    // Create notification for employer
    await Notification.create({
      user: job.user._id,
      type: 'new_application',
      title: 'Ứng viên mới ứng tuyển',
      message: `Có ứng viên mới ứng tuyển vào vị trí "${job.title}"`,
      relatedTo: {
        model: 'Application',
        id: application._id
      },
      link: `/employer/applications/${application._id}`
    });

    res.status(201).json({
      success: true,
      data: application,
      message: 'Ứng tuyển thành công'
    });
  } catch (error) {
    // Hai request nộp cùng lúc: request thứ hai vấp unique index { job, user }
    if (error.code === 11000) {
      return fail(400, 'Bạn đã ứng tuyển vào vị trí này');
    }
    console.error('Apply for job error:', error);
    return fail(500, 'Server Error');
  }
};

// Get all applications for a specific job
export const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if job exists and user is the owner
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin tuyển dụng'
      });
    }

    if (job.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem ứng viên của tin tuyển dụng này'
      });
    }

    // ?status=: lọc theo trạng thái. Không gửi thì lấy mọi đơn trừ đơn đã rút (tab "Tất cả" của FE).
    const status = queryString(req.query.status);
    if (req.query.status !== undefined && !APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Trạng thái đơn không hợp lệ' });
    }
    const filter = { job: job._id, status: status ?? { $ne: 'withdrawn' } };
    const { limit, skip } = paging(req.query, JOB_APPLICATIONS_PAGE_SIZE);

    const [applications, total, grouped] = await Promise.all([
      Application.find(filter)
        .populate({
          path: 'user',
          select: 'name email avatar'
        })
        .populate({
          path: 'profile',
          select: 'title skills location desiredSalary'
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(filter),
      // Số đơn theo từng trạng thái (mọi đơn của tin, không phụ thuộc trang/bộ lọc) cho các tab
      Application.aggregate([{ $match: { job: job._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }])
    ]);

    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, grouped.find((g) => g._id === s)?.n ?? 0]));
    counts.all = grouped.filter((g) => g._id !== 'withdrawn').reduce((sum, g) => sum + g.n, 0);

    res.status(200).json({
      success: true,
      ...pageInfo(applications.length, total, limit),
      counts,
      data: applications
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get application details
export const getApplicationDetails = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email avatar phone'
      })
      .populate({
        path: 'profile',
        select: 'title bio skills experience education socialMedia location website'
      })
      .populate({
        path: 'job',
        select: 'title company user location status applicationDeadline',
        populate: {
          path: 'company',
          select: 'name logo'
        }
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    // Check authorization
    // job/user may be null if the related document was deleted
    const jobOwnerId = application.job?.user?.toString();
    const applicantId = application.user?._id?.toString();

    if (req.user.role === 'employer' && jobOwnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem hồ sơ ứng tuyển này'
      });
    }

    if (req.user.role === 'jobseeker' && applicantId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem hồ sơ ứng tuyển này'
      });
    }

    // If employer is viewing, mark as viewed
    if (
      req.user.role === 'employer' && 
      application.status === 'pending'
    ) {
      application.status = 'viewed';
      await application.save();
      
      // Notify jobseeker
      await Notification.create({
        user: application.user._id,
        type: 'application_status',
        title: 'Đơn ứng tuyển đã được xem',
        message: `Nhà tuyển dụng đã xem đơn ứng tuyển của bạn cho vị trí "${application.job.title}"`,
        relatedTo: {
          model: 'Application',
          id: application._id
        },
        link: `/jobseeker/applications/${application._id}`
      });
    }

    res.status(200).json({
      success: true,
      data: req.user.role === 'jobseeker' ? withoutPrivateNotes(application) : application
    });
  } catch (error) {
    console.error('Get application details error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Update application status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    if (!status || !['pending', 'viewed', 'interview', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp trạng thái hợp lệ'
      });
    }
    
    let application = await Application.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'title user'
      })
      .populate({
        path: 'user',
        select: 'name'
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    // Check if user is the employer who posted the job
    if (application.job?.user?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật trạng thái ứng tuyển này'
      });
    }

    if (application.status === 'withdrawn') {
      return withdrawnError(res);
    }

    // Update application
    application.status = status;
    
    if (feedback !== undefined && feedback !== null && feedback !== '') {
      if (typeof feedback !== 'string' || feedback.trim().length > MAX_FEEDBACK) {
        return res.status(400).json({ success: false, error: `Phản hồi tối đa ${MAX_FEEDBACK} ký tự` });
      }
      application.employerFeedback = feedback.trim();
    }

    await application.save();

    // Create notification for jobseeker
    let notificationTitle, notificationMessage;
    
    switch (status) {
      case 'interview':
        notificationTitle = 'Lời mời phỏng vấn';
        notificationMessage = `Bạn đã được mời phỏng vấn cho vị trí "${application.job.title}"`;
        break;
      case 'accepted':
        notificationTitle = 'Chúc mừng! Đơn ứng tuyển được chấp nhận';
        notificationMessage = `Đơn ứng tuyển của bạn cho vị trí "${application.job.title}" đã được chấp nhận`;
        break;
      case 'rejected':
        notificationTitle = 'Đơn ứng tuyển không được chấp nhận';
        notificationMessage = `Đơn ứng tuyển của bạn cho vị trí "${application.job.title}" đã bị từ chối`;
        break;
      default:
        notificationTitle = 'Cập nhật đơn ứng tuyển';
        notificationMessage = `Đơn ứng tuyển của bạn cho vị trí "${application.job.title}": ${STATUS_LABELS[status]}`;
    }

    await Notification.create({
      user: application.user._id,
      type: 'application_status',
      title: notificationTitle,
      message: notificationMessage + (feedback ? `. Phản hồi: ${String(feedback).trim()}` : ''),
      relatedTo: {
        model: 'Application',
        id: application._id
      },
      link: `/jobseeker/applications/${application._id}`
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Cập nhật trạng thái thành công'
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Schedule an interview
export const scheduleInterview = async (req, res) => {
  try {
    const { date, location, type, notes } = req.body;

    const interviewDate = new Date(date);
    if (!date || Number.isNaN(interviewDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn ngày giờ phỏng vấn hợp lệ' });
    }
    if (interviewDate < new Date()) {
      return res.status(400).json({ success: false, error: 'Thời gian phỏng vấn phải ở tương lai' });
    }
    if (!INTERVIEW_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn hình thức phỏng vấn' });
    }
    if (typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({
        success: false,
        error: type === 'in-person' ? 'Vui lòng nhập địa chỉ phỏng vấn' : 'Vui lòng nhập link hoặc số điện thoại phỏng vấn'
      });
    }
    if (location.trim().length > 300 || (notes && String(notes).length > MAX_NOTE)) {
      return res.status(400).json({ success: false, error: 'Địa điểm tối đa 300 ký tự, lưu ý tối đa 1000 ký tự' });
    }

    let application = await Application.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'title user'
      })
      .populate({
        path: 'user',
        select: 'name'
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    // Check if user is the employer who posted the job
    if (application.job?.user?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật ứng tuyển này'
      });
    }

    if (application.status === 'withdrawn') {
      return withdrawnError(res);
    }

    // Add interview to application
    const interview = {
      date: interviewDate,
      location: location.trim(),
      type,
      notes: notes ? String(notes).trim() : ''
    };

    application.interviews.push(interview);
    application.status = 'interview';
    await application.save();

    // Create notification for jobseeker
    await Notification.create({
      user: application.user._id,
      type: 'interview_invitation',
      title: 'Lời mời phỏng vấn',
      message: `Bạn đã được mời phỏng vấn cho vị trí "${application.job.title}" lúc ${formatVnDateTime(interviewDate)}`,
      relatedTo: {
        model: 'Application',
        id: application._id
      },
      link: `/jobseeker/applications/${application._id}`
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Đã lên lịch phỏng vấn thành công'
    });
  } catch (error) {
    console.error('Schedule interview error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get application CV
export const getApplicationCV = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'user'
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    // Check authorization
    if (
      req.user.role === 'employer' && 
      application.job?.user?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem CV này'
      });
    }

    if (
      req.user.role === 'jobseeker' && 
      application.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem CV này'
      });
    }

    const filePath = resolveUploadFile(CV_DIR, application.attachedCV);
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy file CV'
      });
    }
    
    res.download(filePath);
  } catch (error) {
    console.error('Get application CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get user's applications
export const getUserApplications = async (req, res) => {
  try {
    const { limit, skip } = paging(req.query, MY_APPLICATIONS_PAGE_SIZE);
    const filter = { user: req.user.id };

    // ?job=<id>: đơn của ứng viên cho một tin (FE dùng để biết đã ứng tuyển tin đó chưa)
    const job = queryString(req.query.job);
    if (req.query.job !== undefined) {
      if (!job || !mongoose.isValidObjectId(job)) {
        return res.status(400).json({ success: false, error: 'Mã tin tuyển dụng không hợp lệ' });
      }
      filter.job = job;
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .select('-notes') // ghi chú nội bộ của NTD
        .populate({
          path: 'job',
          select: 'title company location status applicationDeadline',
          populate: {
            path: 'company',
            select: 'name logo'
          }
        })
        // _id làm tiêu chí phụ: createdAt có thể trùng, sort không duy nhất làm phân trang lặp/sót
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      ...pageInfo(applications.length, total, limit),
      data: applications
    });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Add note to application
export const addApplicationNote = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập nội dung ghi chú'
      });
    }
    if (content.trim().length > MAX_NOTE) {
      return res.status(400).json({ success: false, error: `Ghi chú tối đa ${MAX_NOTE} ký tự` });
    }

    let application = await Application.findById(req.params.id)
      .populate({
        path: 'job',
        select: 'user'
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    // Check if user is the employer who posted the job
    if (application.job?.user?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thêm ghi chú cho ứng tuyển này'
      });
    }

    // Add note
    application.notes.push({ content: content.trim() });
    await application.save();

    res.status(200).json({
      success: true,
      data: application,
      message: 'Đã thêm ghi chú thành công'
    });
  } catch (error) {
    console.error('Add application note error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};
// Withdraw (cancel) an application - jobseeker only
export const cancelApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate({
      path: 'job',
      select: 'title user'
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ ứng tuyển'
      });
    }

    if (application.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền rút đơn ứng tuyển này'
      });
    }

    if (!WITHDRAWABLE_STATUSES.includes(application.status)) {
      const reasons = {
        accepted: 'Đơn đã được chấp nhận, không thể rút',
        rejected: 'Đơn đã bị từ chối, không thể rút',
        withdrawn: 'Bạn đã rút đơn này rồi'
      };
      return res.status(400).json({
        success: false,
        error: reasons[application.status] || 'Không thể rút đơn ở trạng thái hiện tại'
      });
    }

    application.status = 'withdrawn';
    await application.save();

    // Let the employer know (job may be missing if it was deleted)
    if (application.job?.user) {
      await Notification.create({
        user: application.job.user,
        type: 'application_status',
        title: 'Ứng viên đã rút đơn',
        message: `Ứng viên ${req.user.name} đã rút đơn ứng tuyển vị trí "${application.job.title}"`,
        relatedTo: {
          model: 'Application',
          id: application._id
        },
        link: `/employer/applications/${application._id}`
      });
    }

    res.status(200).json({
      success: true,
      data: withoutPrivateNotes(application),
      message: 'Đã rút đơn ứng tuyển'
    });
  } catch (error) {
    console.error('Cancel application error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};
