import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Liên kết khóa ngoại tới bảng User
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên sản phẩm'],
      trim: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Giá không thể nhỏ hơn 0'],
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Số lượng tồn kho không thể âm'],
      default: 0,
    },
    image_url: {
      type: String,
      default: '', // Đường dẫn ảnh từ Cloudinary
    },
    category: {//Danh mục sản phẩm
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Sản phẩm phải thuộc một danh mục"]
    },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);