import JobseekerProfile from '../../models/jobseeker/Profile.js';
import User from '../../models/User.js';
import fs from 'fs';
import { clearAuthCookie } from '../../utils/authCookie.js';
import { deleteUserAccount } from '../../utils/deleteUserAccount.js';
import { LIMITS, checkPeriod, checkSkills, checkText, checkUrl } from '../../utils/profileValidation.js';
import {
  AVATAR_DIR,
  DEFAULT_AVATAR,
  resolveUploadFile,
  removeUploadFile
} from '../../config/paths.js';

// Get current user profile
export const getCurrentProfile = async (req, res) => {
  try {
    const profile = await JobseekerProfile.findOne({ user: req.user.id }).populate('user', 'name email role');

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Chưa có hồ sơ cho người dùng này'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Lỗi dữ liệu đầu vào: ném ra trong lúc kiểm tra, khối catch đổi thành response 400
class BadInput extends Error {}

// Lấy value từ kết quả { error } | { value } của các hàm trong utils/profileValidation.js
const take = (result) => {
  if (result.error) throw new BadInput(result.error);
  return result.value;
};

// Trả lỗi: 400 cho dữ liệu sai, 500 cho lỗi khác (không gửi error.message ra ngoài)
const sendError = (res, error, context) => {
  if (error instanceof BadInput) {
    return res.status(400).json({ success: false, error: error.message });
  }
  // Mongoose kiểm tra lại (enum, kiểu ngày...) mà vẫn sai
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Dữ liệu hồ sơ không hợp lệ' });
  }
  console.error(`${context} error:`, error);
  return res.status(500).json({ success: false, error: 'Server Error' });
};

const WORK_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];

// Create or update user profile.
// Ghi đè toàn bộ thông tin chung: field nào không gửi lên sẽ về giá trị rỗng.
// Học vấn, kinh nghiệm và CV KHÔNG bị ảnh hưởng (có API riêng).
export const createOrUpdateProfile = async (req, res) => {
  try {
    const body = req.body;

    const title = take(checkText(body.title, 'Tiêu đề hồ sơ', LIMITS.title));
    if (!title) throw new BadInput('Tiêu đề hồ sơ là bắt buộc');

    const workType = body.workType || 'full-time';
    if (!WORK_TYPES.includes(workType)) throw new BadInput('Hình thức làm việc không hợp lệ');

    let desiredSalary = 0; // 0 = chưa nhập / thoả thuận
    if (body.desiredSalary !== undefined && body.desiredSalary !== null && body.desiredSalary !== '') {
      desiredSalary = Number(body.desiredSalary);
      if (!Number.isFinite(desiredSalary) || desiredSalary < 0) {
        throw new BadInput('Mức lương mong muốn phải là số không âm');
      }
    }

    let availableFrom = null;
    if (body.availableFrom) {
      availableFrom = new Date(body.availableFrom);
      if (Number.isNaN(availableFrom.getTime())) throw new BadInput('Ngày có thể đi làm không hợp lệ');
    }

    const socialMedia = body.socialMedia ?? {};

    const profileFields = {
      user: req.user.id,
      title,
      bio: take(checkText(body.bio, 'Giới thiệu', LIMITS.bio)),
      location: take(checkText(body.location, 'Địa điểm', LIMITS.shortText)),
      phone: take(checkText(body.phone, 'Số điện thoại', 20)),
      desiredPosition: take(checkText(body.desiredPosition, 'Vị trí mong muốn', LIMITS.shortText)),
      website: take(checkUrl(body.website, 'Website')),
      socialMedia: {
        linkedin: take(checkUrl(socialMedia.linkedin, 'LinkedIn')),
        github: take(checkUrl(socialMedia.github, 'GitHub')),
        twitter: take(checkUrl(socialMedia.twitter, 'Twitter'))
      },
      desiredSalary,
      workType,
      availableFrom,
      dob: body.dob || null,
      visibility: body.visibility !== undefined ? Boolean(body.visibility) : true
    };

    // Chỉ đổi kỹ năng khi có gửi lên. Gửi [] hoặc "" là xoá hết kỹ năng.
    if (body.skills !== undefined) {
      profileFields.skills = take(checkSkills(body.skills));
    }

    let profile = await JobseekerProfile.findOne({ user: req.user.id });

    if (profile) {
      // runValidators: không có option này thì findOneAndUpdate bỏ qua enum/required của schema
      profile = await JobseekerProfile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        data: profile,
        message: 'Hồ sơ đã được cập nhật'
      });
    }

    profile = await JobseekerProfile.create(profileFields);

    res.status(201).json({
      success: true,
      data: profile,
      message: 'Hồ sơ đã được tạo'
    });
  } catch (error) {
    return sendError(res, error, 'Create profile');
  }
};

// ===== Học vấn và kinh nghiệm =====
// Hai loại có cùng cách xử lý, chỉ khác tên field. Cấu hình ở đây rồi dùng chung các hàm bên dưới.
const ITEM_TYPES = {
  education: {
    label: 'thông tin học vấn',
    required: [['school', 'tên trường'], ['degree', 'bằng cấp'], ['fieldOfStudy', 'chuyên ngành']],
    optional: [],
    added: 'Thêm thông tin học vấn thành công',
    updated: 'Đã cập nhật thông tin học vấn',
    deleted: 'Đã xóa thông tin học vấn'
  },
  experience: {
    label: 'kinh nghiệm làm việc',
    required: [['company', 'tên công ty'], ['position', 'vị trí']],
    optional: [['location', 'Địa điểm']],
    added: 'Thêm kinh nghiệm làm việc thành công',
    updated: 'Đã cập nhật kinh nghiệm làm việc',
    deleted: 'Đã xóa kinh nghiệm làm việc'
  }
};

// Kiểm tra body và tạo object cho một mục (chỉ lấy các field được phép)
const buildItem = (type, body) => {
  const config = ITEM_TYPES[type];
  const item = {};

  for (const [field, label] of config.required) {
    const value = take(checkText(body[field], label, LIMITS.shortText));
    if (!value) throw new BadInput(`Vui lòng nhập ${label}`);
    item[field] = value;
  }
  for (const [field, label] of config.optional) {
    item[field] = take(checkText(body[field], label, LIMITS.shortText));
  }

  Object.assign(item, take(checkPeriod(body)));
  item.description = take(checkText(body.description, 'Mô tả', LIMITS.description));
  return item;
};

// Mục đang học/làm lên đầu, còn lại xếp theo ngày bắt đầu mới nhất
const sortItems = (items) =>
  items.sort((a, b) => Number(b.current) - Number(a.current) || b.from - a.from);

const findOwnProfile = async (userId) => {
  const profile = await JobseekerProfile.findOne({ user: userId });
  if (!profile) throw new BadInput('Bạn cần lưu thông tin chung của hồ sơ trước');
  return profile;
};

const addItem = (type) => async (req, res) => {
  try {
    const item = buildItem(type, req.body);
    const profile = await findOwnProfile(req.user.id);

    profile[type].push(item);
    sortItems(profile[type]);
    await profile.save();

    res.status(200).json({ success: true, data: profile, message: ITEM_TYPES[type].added });
  } catch (error) {
    return sendError(res, error, `Add ${type}`);
  }
};

const updateItem = (type, param) => async (req, res) => {
  try {
    const item = buildItem(type, req.body);
    const profile = await findOwnProfile(req.user.id);

    // .id(): tìm phần tử trong mảng con theo _id (hàm có sẵn của Mongoose)
    const existing = profile[type].id(req.params[param]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Không tìm thấy ${ITEM_TYPES[type].label}` });
    }

    existing.set(item);
    sortItems(profile[type]);
    await profile.save();

    res.status(200).json({ success: true, data: profile, message: ITEM_TYPES[type].updated });
  } catch (error) {
    return sendError(res, error, `Update ${type}`);
  }
};

const deleteItem = (type, param) => async (req, res) => {
  try {
    const profile = await JobseekerProfile.findOne({ user: req.user.id });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ' });
    }

    const existing = profile[type].id(req.params[param]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Không tìm thấy ${ITEM_TYPES[type].label}` });
    }

    existing.deleteOne(); // xoá phần tử khỏi mảng con
    await profile.save();

    res.status(200).json({ success: true, data: profile, message: ITEM_TYPES[type].deleted });
  } catch (error) {
    return sendError(res, error, `Delete ${type}`);
  }
};

export const addEducation = addItem('education');
export const updateEducation = updateItem('education', 'edu_id');
export const deleteEducation = deleteItem('education', 'edu_id');
export const addExperience = addItem('experience');
export const updateExperience = updateItem('experience', 'exp_id');
export const deleteExperience = deleteItem('experience', 'exp_id');

// Get all profiles
export const getAllProfiles = async (req, res) => {
  try {
    // cvFile is never exposed in listings; CVs are only reachable through
    // the permission-checked /api/cv and /api/applications/:id/cv endpoints
    const profiles = await JobseekerProfile.find({ visibility: true })
      .populate('user', 'name avatar')
      .select('-__v -cvFile');

    res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles
    });
  } catch (error) {
    console.error('Get all profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get profile by ID
export const getProfileById = async (req, res) => {
  try {
    // Employers/admins can view public profiles; a jobseeker can only view their own
    const isOwner = req.params.user_id === req.user.id;
    if (!isOwner && !['employer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem hồ sơ này'
      });
    }

    const profile = await JobseekerProfile.findOne({
      user: req.params.user_id,
      ...(isOwner ? {} : { visibility: true })
    })
      .populate('user', 'name avatar')
      .select('-cvFile');

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ cho người dùng này'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile by id error:', error);
    
    // Check if error is due to invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Delete profile and user (with all related data and files)
export const deleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tài khoản'
      });
    }

    await deleteUserAccount(user);

    // Log the browser out
    clearAuthCookie(res);

    res.status(200).json({
      success: true,
      message: 'Đã xóa tài khoản'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Upload user avatar
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng upload file ảnh'
      });
    }

    // Get user
    const user = await User.findById(req.user.id);

    // Delete old avatar if it's not the default
    if (user.avatar !== DEFAULT_AVATAR) {
      removeUploadFile(AVATAR_DIR, user.avatar);
    }

    // Update user avatar
    user.avatar = req.file.filename;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        avatar: req.file.filename,
        avatarUrl: `/uploads/avatars/${req.file.filename}`
      },
      message: 'Avatar đã được cập nhật'
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete user avatar (reset to default)
export const resetAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Delete current avatar if not default
    if (user.avatar !== DEFAULT_AVATAR) {
      removeUploadFile(AVATAR_DIR, user.avatar);

      // Reset to default avatar
      user.avatar = DEFAULT_AVATAR;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Đã khôi phục avatar mặc định'
    });
  } catch (error) {
    console.error('Avatar reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get user avatar
export const getAvatar = async (req, res) => {
  try {
    const filename = req.params.filename;
    
    const avatarPath = resolveUploadFile(AVATAR_DIR, filename);
    
    if (!avatarPath || !fs.existsSync(avatarPath)) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy avatar'
      });
    }
    
    res.sendFile(avatarPath);
  } catch (error) {
    console.error('Get avatar error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};