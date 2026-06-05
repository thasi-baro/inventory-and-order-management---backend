import User from "../models/User.js";
import { redis } from '../config/redis.js'
//Thông tin user đang đăng nhập
export const authMe = async (req, res) => {
    try {
        const user = req.user; // Lấy từ middleware 
        return res.status(200).json({ user })
    } catch (error) {
        console.error('Lỗi khi gọi authMeh:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' })
    }
}

//Cập nhật username và ngưỡng cảnh báo
export const updateUserSetting = async (req, res) => {
    try {
        //Lấy thông tin user nhập
        const { username, lowStockThreshold } = req.body;
        const userId = req.user._id;

        //Tìm và cập nhật
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, lowStockThreshold },
            { new: true }
        )
        await redis.del(`dashboard_stats_${userId}`); //Xóa redis cache để dashboard luôn có dữ liệu mới nhất
        return res.status(200).json({ success: true, user: updatedUser })
    } catch (error) {
        console.error('Lỗi tại updateUserSetting:', error)
        res.status(500).json({ success: false, message: 'Lỗi hệ thống' })
    }
}