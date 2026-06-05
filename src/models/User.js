import mongoose from 'mongoose';
import validator from 'validator';//Xác thực

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Vui lòng nhập tên đăng nhập'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Vui lòng nhập địa chỉ email hợp lệ']//kiểm tra định dạng email
    },
    password_hash: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
    },
    // Ngưỡng cảnh báo sản phẩm hết hàng (cập nhật thêm cho user có thể tùy chỉnh dựa vào nhu cầu)
    lowStockThreshold: { type: Number, default: 10 }
  },
  { timestamps: true } // Tự động thêm createdAt và updatedAt
);

export default mongoose.model('User', userSchema);