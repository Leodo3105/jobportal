import ErrorResponse from '../utils/errorResponse.js';

/**
 * Middleware xử lý lỗi nâng cao
 * Xử lý các loại lỗi từ Mongoose và trả về response lỗi thống nhất
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log lỗi cho việc debug trong môi trường development
  console.error(err);

  // Mongoose - lỗi ObjectId không hợp lệ
  if (err.name === 'CastError') {
    const message = `Không tìm thấy tài nguyên với id: ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose - lỗi trùng lặp giá trị unique
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Giá trị ${field} đã tồn tại trong hệ thống`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose - lỗi validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.join(', ');
    error = new ErrorResponse(message, 400);
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token không hợp lệ';
    error = new ErrorResponse(message, 401);
  }

  // Lỗi JWT hết hạn
  if (err.name === 'TokenExpiredError') {
    const message = 'Token đã hết hạn, vui lòng đăng nhập lại';
    error = new ErrorResponse(message, 401);
  }

  // Lỗi từ body-parser (JSON sai cú pháp, body quá lớn...) mang sẵn mã 4xx
  if (err.type === 'entity.parse.failed') {
    error = new ErrorResponse('Dữ liệu JSON không hợp lệ', 400);
  } else if (err.type === 'entity.too.large') {
    error = new ErrorResponse('Dữ liệu gửi lên quá lớn', 413);
  } else if (err.expose && err.status >= 400 && err.status < 500) {
    error = new ErrorResponse(err.message, err.status);
  }

  // Lỗi upload từ multer (quá kích thước, sai tên field, quá số file...)
  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'File vượt quá kích thước tối đa cho phép',
      LIMIT_UNEXPECTED_FILE: `Trường file không hợp lệ: ${err.field}`
    };
    error = new ErrorResponse(messages[err.code] || `Lỗi upload file: ${err.message}`, 400);
  }

  // Lỗi sai loại file upload
  if (err.message && err.message.includes('Chỉ chấp nhận file')) {
    error = new ErrorResponse(err.message, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Lỗi máy chủ, vui lòng thử lại sau'
  });
};

export default errorHandler;