// Create an admin account (or promote an existing user to admin).
// Usage: npm run create-admin -- <email> <password> [name]
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

dotenv.config();

const [email, password, name = 'Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Cách dùng: npm run create-admin -- <email> <password> [name]');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('Thiếu MONGO_URI trong file .env');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email }).select('+password');

  if (user) {
    user.role = 'admin';
    user.password = password; // re-hashed by the pre-save hook
    await user.save();
    console.log(`Đã cập nhật ${email} thành admin.`);
  } else {
    user = await User.create({ name, email, password, role: 'admin' });
    console.log(`Đã tạo tài khoản admin ${email}.`);
  }
} catch (error) {
  console.error('Lỗi tạo admin:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
