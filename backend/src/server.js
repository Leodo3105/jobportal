import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { UPLOAD_ROOT, ensureUploadDirs } from './config/paths.js';
import { allowedOrigins } from './config/origins.js';
import errorHandler from './middlewares/error.js';
import checkOrigin from './middlewares/checkOrigin.js';
import { startScheduler } from './jobs/scheduler.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Tác vụ định kỳ (tin/gói hết hạn): đợi kết nối DB xong mới chạy.
// Tắt khi test để tác vụ không chen vào giữa các bộ e2e (bộ scheduled-tasks tự gọi npm run tasks).
if (process.env.NODE_ENV !== 'test') {
  mongoose.connection.once('open', startScheduler);
}

const app = express();

if (process.env.TRUST_PROXY) {
  const hops = parseInt(process.env.TRUST_PROXY, 10);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({ origin: allowedOrigins(), credentials: true }));

// Body parser with a size limit, and cookie parser for the auth cookie
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF protection: reject state-changing requests from foreign origins
app.use('/api', checkOrigin);

// Limit brute-force on auth endpoints: 20 requests / 15 minutes / IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' }
});
app.use(
  ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password'],
  authLimiter
);

// Đổi mật khẩu: chống dò mật khẩu hiện tại khi đã có phiên đăng nhập (bộ đếm riêng)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' }
});
app.use('/api/auth/password', passwordLimiter);

// Logging middleware in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Make sure upload folders and default images exist
ensureUploadDirs();

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to JobPortal API' });
});

app.use('/uploads/cv', (req, res) => {
  res.status(404).json({ success: false, error: 'Không tìm thấy file' });
});

// Serve public files (avatars, logos) from uploads folder
app.use('/uploads', express.static(UPLOAD_ROOT));

// Import Routes
import authRoutes from './routes/auth/authRoutes.js';
import profileRoutes from './routes/jobseeker/profileRoutes.js';
import cvRoutes from './routes/jobseeker/cvRoutes.js';
import jobRoutes from './routes/job/jobRoutes.js';
import applicationRoutes from './routes/job/applicationRoutes.js';
import savedJobRoutes from './routes/job/savedJobRoutes.js';
import companyRoutes from './routes/employer/companyRoutes.js';
import notificationRoutes from './routes/notification/notificationRoutes.js';
import messageRoutes from './routes/chat/messageRoutes.js';
import categoryRoutes from './routes/category/categoryRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import adminRoutes from './routes/admin/adminRoutes.js';


// Mount Routes
// Auth routes
app.use('/api/auth', authRoutes);

// Jobseeker routes
app.use('/api/profiles', profileRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/saved-jobs', savedJobRoutes);

// Job routes
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);

// Employer routes
app.use('/api/companies', companyRoutes);
app.use('/api/admin', adminRoutes);

// General routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);



// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.stack || err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.stack || err);
  // Close server & exit process
  server.close(() => process.exit(1));
});