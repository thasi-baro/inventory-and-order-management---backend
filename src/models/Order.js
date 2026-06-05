import mongoose from 'mongoose';

// Schema con để nhúng vào Order (Order_Items)
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
  // Lưu lại giá tại thời điểm mua để không bị ảnh hưởng nếu giá sản phẩm thay đổi sau này
  unit_price: {
    type: Number,
    required: true,
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
    orderCode: {//Mã đơn hàng
      type: String,
      required: true,
      unique: true,
    },
    customerInfo: { // Thông tin người mua để gửi mail
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: false },
    },
  },
  { timestamps: true }
);
//Đánh chỉ mục 3 cột này vì chúng đc dùng nhiều để lấy dữ liệu dashboard
orderSchema.index({ user: 1, createdAt: -1, status: 1 });
export default mongoose.model('Order', orderSchema);