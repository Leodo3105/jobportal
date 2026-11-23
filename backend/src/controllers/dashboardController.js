// src/controllers/dashboardController.js
import User from '../models/User.js';
import Job from '../models/job/Job.js';
import Company from '../models/employer/Company.js';
import Application from '../models/job/Application.js';
import JobseekerProfile from '../models/jobseeker/Profile.js';
import SavedJob from '../models/job/SavedJob.js';

// Get admin dashboard statistics
const VN_TZ = 'Asia/Ho_Chi_Minh';
const MONTHS = 6;

// Khoá tháng dạng "2026-11" theo giờ Việt Nam, cho `offset` tháng trước tháng hiện tại.
// Tự tính năm/tháng thay vì setMonth(): ngày 31/3 lùi 1 tháng bằng setMonth thành "31/2" → 3/3 (trùng tháng).
const monthKeys = () => {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ, year: 'numeric', month: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  const keys = [];
  for (let offset = MONTHS - 1; offset >= 0; offset--) {
    const index = year * 12 + (month - 1) - offset; // đếm tháng liên tục để lùi qua năm cho đúng
    keys.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`);
  }
  return keys;
};

// Đếm số bản ghi theo tháng tạo (giờ VN) trong MONTHS tháng gần nhất, bằng một truy vấn.
// Trước đây mỗi tháng một countDocuments, và mốc "cuối tháng" là 00:00 ngày cuối → bỏ sót cả ngày đó.
// `match`: điều kiện lọc thêm (ví dụ chỉ tin của một công ty), mặc định đếm tất cả.
const countByMonth = async (Model, keys, match = {}) => {
  const [firstYear, firstMonth] = keys[0].split('-').map(Number);
  // 00:00 ngày 1 của tháng đầu tiên theo giờ VN (UTC+7, không đổi giờ mùa hè)
  const since = new Date(Date.UTC(firstYear, firstMonth - 1, 1) - 7 * 60 * 60 * 1000);
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: VN_TZ } }, n: { $sum: 1 } } }
  ]);
  const byMonth = new Map(rows.map((row) => [row._id, row.n]));
  return keys.map((key) => byMonth.get(key) ?? 0);
};

// Đếm theo một field: { giá trị: số lượng }
const countBy = async (Model, field, match = {}) => {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id ?? 'unknown', row.n]));
};

export const getAdminDashboard = async (req, res) => {
  try {
    const keys = monthKeys();
    const [
      usersByRole,
      lockedUsers,
      jobsByStatus,
      openJobs,
      applicationsByStatus,
      totalCompanies,
      featuredCompanies,
      totalProfiles,
      profilesWithCV,
      newUsers,
      newJobs,
      newApplications,
      jobCategories,
      jobLocations
    ] = await Promise.all([
      countBy(User, 'role'),
      User.countDocuments({ isActive: false }),
      countBy(Job, 'status'),
      // Tin ứng viên thực sự thấy: active và còn hạn
      Job.countDocuments({ status: 'active', applicationDeadline: { $gte: new Date() } }),
      countBy(Application, 'status'),
      Company.countDocuments(),
      Company.countDocuments({ featured: true }),
      JobseekerProfile.countDocuments(),
      // $nin [null, '']: loại cả hồ sơ không có field cvFile ($ne: '' vẫn đếm những hồ sơ đó)
      JobseekerProfile.countDocuments({ cvFile: { $nin: [null, ''] } }),
      countByMonth(User, keys),
      countByMonth(Job, keys),
      countByMonth(Application, keys),
      Job.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
      Job.aggregate([{ $group: { _id: '$location', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }])
    ]);

    const sum = (counts) => Object.values(counts).reduce((total, n) => total + n, 0);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: sum(usersByRole),
          jobseekers: usersByRole.jobseeker ?? 0,
          employers: usersByRole.employer ?? 0,
          admins: usersByRole.admin ?? 0,
          locked: lockedUsers
        },
        jobs: {
          total: sum(jobsByStatus),
          active: jobsByStatus.active ?? 0,
          open: openJobs,
          closed: jobsByStatus.closed ?? 0,
          expired: jobsByStatus.expired ?? 0,
          draft: jobsByStatus.draft ?? 0
        },
        applications: {
          total: sum(applicationsByStatus),
          pending: applicationsByStatus.pending ?? 0,
          viewed: applicationsByStatus.viewed ?? 0,
          interview: applicationsByStatus.interview ?? 0,
          accepted: applicationsByStatus.accepted ?? 0,
          rejected: applicationsByStatus.rejected ?? 0,
          withdrawn: applicationsByStatus.withdrawn ?? 0
        },
        companies: {
          total: totalCompanies,
          featured: featuredCompanies
        },
        profiles: {
          total: totalProfiles,
          withCV: profilesWithCV
        },
        charts: {
          labels: keys, // "2026-11": FE tự định dạng thành chữ tiếng Việt
          datasets: {
            newUsers,
            newJobs,
            newApplications
          }
        },
        popular: {
          categories: jobCategories,
          locations: jobLocations
        }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get employer dashboard statistics
export const getEmployerDashboard = async (req, res) => {
  try {
    const company = await Company.findOne({ user: req.user.id });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin công ty'
      });
    }

    const jobMatch = { company: company._id };
    const jobIds = await Job.find(jobMatch).distinct('_id');
    const applicationMatch = { job: { $in: jobIds } };
    const keys = monthKeys();

    const [jobsByStatus, openJobs, applicationsByStatus, newJobs, newApplications, topJobs] = await Promise.all([
      countBy(Job, 'status', jobMatch),
      // Tin ứng viên thực sự thấy: active và còn hạn
      Job.countDocuments({ ...jobMatch, status: 'active', applicationDeadline: { $gte: new Date() } }),
      countBy(Application, 'status', applicationMatch),
      countByMonth(Job, keys, jobMatch),
      countByMonth(Application, keys, applicationMatch),
      // 5 tin nhiều đơn nhất. Không tính đơn đã rút, khớp số đơn ở trang "Tin tuyển dụng".
      Job.aggregate([
        { $match: jobMatch },
        {
          $lookup: {
            from: 'applications',
            localField: '_id',
            foreignField: 'job',
            as: 'applications',
            pipeline: [{ $match: { status: { $ne: 'withdrawn' } } }, { $project: { status: 1 } }]
          }
        },
        {
          $project: {
            title: 1,
            status: 1,
            applicationDeadline: 1,
            views: 1,
            applicationsCount: { $size: '$applications' },
            pendingCount: {
              $size: { $filter: { input: '$applications', cond: { $eq: ['$$this.status', 'pending'] } } }
            }
          }
        },
        { $sort: { applicationsCount: -1, views: -1 } },
        { $limit: 5 }
      ])
    ]);

    const sum = (counts) => Object.values(counts).reduce((total, n) => total + n, 0);

    res.status(200).json({
      success: true,
      data: {
        jobs: {
          total: sum(jobsByStatus),
          active: jobsByStatus.active ?? 0,
          open: openJobs,
          closed: jobsByStatus.closed ?? 0,
          expired: jobsByStatus.expired ?? 0,
          draft: jobsByStatus.draft ?? 0
        },
        applications: {
          total: sum(applicationsByStatus),
          pending: applicationsByStatus.pending ?? 0,
          viewed: applicationsByStatus.viewed ?? 0,
          interview: applicationsByStatus.interview ?? 0,
          accepted: applicationsByStatus.accepted ?? 0,
          rejected: applicationsByStatus.rejected ?? 0,
          withdrawn: applicationsByStatus.withdrawn ?? 0
        },
        charts: {
          labels: keys, // "2026-11": FE tự định dạng thành chữ tiếng Việt
          datasets: {
            newJobs,
            newApplications
          }
        },
        topJobs
      }
    });
  } catch (error) {
    console.error('Get employer dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get jobseeker dashboard statistics
export const getJobseekerDashboard = async (req, res) => {
  try {
    // Applications statistics
    const totalApplications = await Application.countDocuments({ user: req.user.id });
    const pendingApplications = await Application.countDocuments({ user: req.user.id, status: 'pending' });
    const viewedApplications = await Application.countDocuments({ user: req.user.id, status: 'viewed' });
    const interviewApplications = await Application.countDocuments({ user: req.user.id, status: 'interview' });
    const acceptedApplications = await Application.countDocuments({ user: req.user.id, status: 'accepted' });
    const rejectedApplications = await Application.countDocuments({ user: req.user.id, status: 'rejected' });
    const withdrawnApplications = await Application.countDocuments({ user: req.user.id, status: 'withdrawn' });
    
    // Saved jobs count
    const savedJobsCount = await SavedJob.countDocuments({ user: req.user.id });
    
    // Profile completion percentage
    let profileCompletionPercentage = 0;
    const profile = await JobseekerProfile.findOne({ user: req.user.id });
    
    if (profile) {
      // Define fields that contribute to profile completion
      const totalFields = 11; // Adjust based on your important fields
      let completedFields = 0;
      
      // Count completed fields
      if (profile.title) completedFields++;
      if (profile.bio) completedFields++;
      if (profile.location) completedFields++;
      if (profile.skills && profile.skills.length > 0) completedFields++;
      if (profile.experience && profile.experience.length > 0) completedFields++;
      if (profile.education && profile.education.length > 0) completedFields++;
      if (profile.cvFile) completedFields++;
      if (profile.desiredPosition) completedFields++;
      if (profile.desiredSalary) completedFields++;
      if (profile.workType) completedFields++;
      if (profile.socialMedia && (profile.socialMedia.linkedin || profile.socialMedia.github)) completedFields++;
      
      profileCompletionPercentage = Math.round((completedFields / totalFields) * 100);
    }
    
    // Monthly statistics - applications per month for the last 6 months
    const months = [];
    const labels = [];
    const applicationsPerMonth = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Format month name
      const monthName = date.toLocaleString('default', { month: 'short' });
      labels.push(`${monthName} ${date.getFullYear()}`);
      
      // Get application count for the month
      const applicationsInMonth = await Application.countDocuments({
        user: req.user.id,
        createdAt: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      });
      
      applicationsPerMonth.push(applicationsInMonth);
    }
    
    // Recent applications
    const recentApplications = await Application.find({ user: req.user.id })
      .populate({
        path: 'job',
        select: 'title company',
        populate: {
          path: 'company',
          select: 'name logo'
        }
      })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          viewed: viewedApplications,
          interview: interviewApplications,
          accepted: acceptedApplications,
          rejected: rejectedApplications,
          withdrawn: withdrawnApplications
        },
        savedJobs: savedJobsCount,
        profileCompletion: profileCompletionPercentage,
        charts: {
          labels,
          datasets: {
            applicationsPerMonth
          }
        },
        recentApplications
      }
    });
  } catch (error) {
    console.error('Get jobseeker dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get dashboard stats based on user role
export const getDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    
    switch (role) {
      case 'admin':
        return await getAdminDashboard(req, res);
      case 'employer':
        return await getEmployerDashboard(req, res);
      case 'jobseeker':
        return await getJobseekerDashboard(req, res);
      default:
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền truy cập dashboard'
        });
    }
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};