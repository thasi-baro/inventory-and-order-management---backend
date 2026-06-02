import mongoose from 'mongoose';
import validator from 'validator';


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
      validate:[validator.isEmail,'Vui lòng nhập địa chỉ email hợp lệ']//kiểm tra định dạng email
    },
    password_hash: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
    },
  },
  { timestamps: true } // Tự động thêm createdAt và updatedAt
);

export default mongoose.model('User', userSchema);