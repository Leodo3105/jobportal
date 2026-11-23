import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên'],
      trim: true,
      maxlength: [50, 'Tên không được quá 50 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Vui lòng nhập email hợp lệ'
      ]
    },
    password: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
      minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'],
      select: false
    },
    role: {
      type: String,
      enum: ['jobseeker', 'employer', 'admin'],
      default: 'jobseeker'
    },
    phone: {
      type: String,
      maxlength: [20, 'Số điện thoại không được quá 20 ký tự']
    },
    avatar: {
      type: String,
      default: 'default-avatar.jpg'
    },
    // false = bị admin khoá: không đăng nhập được, mọi request có token bị chặn ở protect
    isActive: {
      type: Boolean,
      default: true
    },
    // Tăng lên mỗi khi đổi/đặt lại mật khẩu. JWT mang số này (field `v`);
    // protect từ chối token có số cũ, nên mọi phiên đăng nhập trước đó hết hiệu lực.
    tokenVersion: {
      type: Number,
      default: 0
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Encrypt password using bcrypt
// Only hash when the password was set or changed, otherwise every save()
// (e.g. avatar update) would re-hash the existing hash and break login.
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, v: this.tokenVersion ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

export default User;