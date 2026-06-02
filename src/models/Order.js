import mongoose from 'mongoose';


// Schema con để nhúng vào Order (Đóng vai trò như bảng Order_Items)
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Số lượng mua phải lớn hơn 0'],
  },
  unit_price: {
    type: Number,
    required: true,
    // Lưu lại giá tại thời điểm mua để không bị ảnh hưởng nếu giá sản phẩm thay đổi sau này
  },
});

// Schema chính cho Đơn hàng
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema], // danh sách chi tiết đơn hàng
    total_amount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);