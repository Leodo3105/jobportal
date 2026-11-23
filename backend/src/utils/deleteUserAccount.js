import JobseekerProfile from '../models/jobseeker/Profile.js';
import User from '../models/User.js';
import Application from '../models/job/Application.js';
import SavedJob from '../models/job/SavedJob.js';
import Job from '../models/job/Job.js';
import Company from '../models/employer/Company.js';
import Notification from '../models/notification/Notification.js';
import Message from '../models/chat/Message.js';
import { AVATAR_DIR, LOGO_DIR, CV_DIR, removeUploadFile } from '../config/paths.js';

// Xoá một tài khoản kèm toàn bộ dữ liệu và file liên quan.
// Dùng chung cho người dùng tự xoá (DELETE /api/profiles) và admin xoá (DELETE /api/admin/users/:id).
// Trả về số lượng đã xoá để báo lại cho admin.
export const deleteUserAccount = async (user) => {
  const userId = user._id;

  // Gom các file CV để xoá khỏi ổ đĩa ở cuối
  const cvFiles = new Set();

  // Dữ liệu ứng viên
  const profile = await JobseekerProfile.findOneAndDelete({ user: userId });
  if (profile?.cvFile) cvFiles.add(profile.cvFile);

  const ownApplications = await Application.find({ user: userId }).select('attachedCV');
  ownApplications.forEach((a) => a.attachedCV && cvFiles.add(a.attachedCV));
  await Application.deleteMany({ user: userId });
  await SavedJob.deleteMany({ user: userId });

  // Dữ liệu nhà tuyển dụng: công ty, tin, đơn của các tin đó
  const company = await Company.findOneAndDelete({ user: userId });
  if (company?.logo) removeUploadFile(LOGO_DIR, company.logo);

  const jobIds = (await Job.find({ user: userId }).select('_id')).map((j) => j._id);
  let jobApplicationCount = 0;
  if (jobIds.length) {
    const jobApplications = await Application.find({ job: { $in: jobIds } }).select('attachedCV');
    jobApplicationCount = jobApplications.length;
    jobApplications.forEach((a) => a.attachedCV && cvFiles.add(a.attachedCV));
    await Application.deleteMany({ job: { $in: jobIds } });
    await SavedJob.deleteMany({ job: { $in: jobIds } });
    await Job.deleteMany({ _id: { $in: jobIds } });
  }

  // Dữ liệu dùng chung
  await Notification.deleteMany({ user: userId });
  await Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] });

  // File: avatar, và CV không còn hồ sơ hay đơn nào dùng
  removeUploadFile(AVATAR_DIR, user.avatar);
  for (const file of cvFiles) {
    const stillUsed =
      (await Application.exists({ attachedCV: file })) || (await JobseekerProfile.exists({ cvFile: file }));
    if (!stillUsed) removeUploadFile(CV_DIR, file);
  }

  await User.findByIdAndDelete(userId);

  return {
    applications: ownApplications.length,
    company: Boolean(company),
    jobs: jobIds.length,
    jobApplications: jobApplicationCount
  };
};
