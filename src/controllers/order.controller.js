import Order from "../models/Order.js";

/**
 * @desc    Tạo đơn hàng mới (Đặt hàng)
 * @route   POST /api/orders
 * @param   {Object} req - Chứa mảng items [{ product, quantity, unit_price }]
 * @return Trạng thái và đơn hàng vừa đặt
 */
export const createOrder = async (req, res) => {
    try {
        const { items } = req.body;
        const userId = req.user._id;

        // Kiểm tra giỏ hàng có trống không
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Giỏ hàng của bạn đang trống' });
        }

        // Tính tổng tiền bằng reduce()
        const total_amount = items.reduce((total, item) => {
            return total + (item.quantity * item.unit_price);
        }, 0);

        //Tạo đơn hàng
        const order = await Order.create({
            user: userId,
            items,
            total_amount
        });

        return res.status(201).json({ message: 'Đặt hàng thành công', order });
    } catch (error) {
        console.error('Lỗi khởi tạo đơn hàng:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Lấy lịch sử đơn hàng của user
 * @route   GET /api/orders
 * @returns Danh sách đơn hàng
 */
export const getAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        // Dùng .populate() để kéo thêm tên và ảnh từ bảng Product sang
        // Dùng .sort({ createdAt: -1 }) để đưa đơn hàng mới nhất lên đầu
        const orders = await Order.find({ user: userId })
            .populate('items.product', 'name image_url') 
            .sort({ createdAt: -1 })
            .lean();
        
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Bạn chưa có đơn hàng nào' });
        }

        return res.status(200).json({ orders });
    } catch (error) {
        console.error('Lỗi truy xuất danh sách đơn hàng:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Xem chi tiết 1 đơn hàng
 * @route   GET /api/orders/:id
*@returns Đơn hàng
*/
export const getOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const orderId = req.params.id;
        
        const order = await Order.findOne({ user: userId, _id: orderId })
            .populate('items.product', 'name price image_url')
            .lean(); 

        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        }

        return res.status(200).json({ order });
    } catch (error) {
        console.error('Lỗi truy xuất chi tiết đơn hàng:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Cập nhật trạng thái đơn hàng (Thường dùng để Hủy đơn)
 * @route   PUT /api/orders/:id/status
 * @returns Đơn hàng sau khi cập nhật
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const orderId = req.params.id;
        const { status } = req.body; // Chỉ nhận vào status mới (ví dụ: 'cancelled')

        // Đảm bảo status gửi lên hợp lệ theo Enum trong DB
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ' });
        }

        const order = await Order.findOneAndUpdate(
            { user: userId, _id: orderId },
            { status }, // Chỉ cho phép update cột status, không cho sửa sản phẩm/giá
            { new: true, runValidators: true }
        );
        
        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng để cập nhật' });
        }

        return res.status(200).json({ message: 'Cập nhật trạng thái thành công', order });
    } catch (error) {
        console.error('Lỗi cập nhật đơn hàng:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Xóa lịch sử đơn hàng
 * @route   DELETE /api/orders/:id
 * @returns Thông bóa trạng thái
 */
export const deleteOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const orderId = req.params.id;

        const order = await Order.findOneAndDelete({ user: userId, _id: orderId });

        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng để xóa' });
        }

        return res.status(200).json({ message: 'Xóa đơn hàng thành công' });
    } catch (error) {
        console.error('Lỗi xóa đơn hàng:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};