import dotenv from 'dotenv';
import {v2 as cloudinary} from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer'

// Load biến môi trường
dotenv.config();

//Khai báo thông tin tài khoản Cloudinary 
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

//Cấu hình nơi lưu trữ
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'electronics-store', // Tên folder trên Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Chỉ cho phép up ảnh
  },
});

//Khởi tạo multer với storage vừa tạo
export const upload = multer({ storage: storage });

export default cloudinary;
