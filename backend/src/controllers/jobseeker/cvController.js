import JobseekerProfile from '../../models/jobseeker/Profile.js';
import Application from '../../models/job/Application.js';
import Job from '../../models/job/Job.js';
import fs from 'fs';
import path from 'path';
import { CV_DIR, resolveUploadFile, removeUploadFile } from '../../config/paths.js';

// Who may download a CV file:
// - admin
// - the jobseeker who owns it (current profile CV or a CV attached to their application)
// - an employer who received an application with this CV for one of their jobs
const canAccessCV = async (user, filename) => {
  if (user.role === 'admin') return true;

  if (user.role === 'jobseeker') {
    return Boolean(
      (await JobseekerProfile.exists({ user: user._id, cvFile: filename })) ||
      (await Application.exists({ user: user._id, attachedCV: filename }))
    );
  }

  if (user.role === 'employer') {
    const jobIds = await Job.find({ user: user._id }).distinct('_id');
    return Boolean(await Application.exists({ job: { $in: jobIds }, attachedCV: filename }));
  }

  return false;
};

// Delete a CV file only when no application still points to it,
// so employers can still download CVs of past applications.
const removeCVIfUnused = async (filename) => {
  if (!filename) return;
  const stillUsed = await Application.exists({ attachedCV: filename });
  if (!stillUsed) removeUploadFile(CV_DIR, filename);
};

// Upload CV file
export const uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng upload file CV'
      });
    }

    // Update profile with CV file path
    let profile = await JobseekerProfile.findOne({ user: req.user.id });

    if (!profile) {
      // Create basic profile if it doesn't exist
      profile = await JobseekerProfile.create({
        user: req.user.id,
        title: `Hồ sơ của ${req.user.name}`,
        cvFile: req.file.filename
      });
    } else {
      const oldCV = profile.cvFile;

      // Update CV file path
      profile.cvFile = req.file.filename;
      await profile.save();

      // Delete old CV file unless an application still uses it
      await removeCVIfUnused(oldCV);
    }

    res.status(200).json({
      success: true,
      data: {
        fileName: req.file.filename,
        filePath: `/api/cv/${req.file.filename}`
      },
      message: 'CV đã được upload thành công'
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Delete CV file
export const deleteCV = async (req, res) => {
  try {
    const profile = await JobseekerProfile.findOne({ user: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ'
      });
    }

    if (!profile.cvFile) {
      return res.status(400).json({
        success: false,
        error: 'Không có CV để xóa'
      });
    }

    // Delete CV file
    const oldCV = profile.cvFile;

    // Update profile
    profile.cvFile = '';
    await profile.save();

    await removeCVIfUnused(oldCV);

    res.status(200).json({
      success: true,
      message: 'CV đã được xóa'
    });
  } catch (error) {
    console.error('CV delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Get CV file
export const getCV = async (req, res) => {
  try {
    const filePath = resolveUploadFile(CV_DIR, req.params.filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy file CV'
      });
    }

    if (!(await canAccessCV(req.user, path.basename(filePath)))) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền tải CV này'
      });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Get CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};