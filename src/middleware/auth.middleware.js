import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Xác minh user là ai
 * @param {*} req - req.headers['authorization']
 * @param {*} res 
 * @param {*} next
 * @returns  req.user - Thông tin user
 */
export const protectedRoute = (req, res, next) => {
    try {
        //Lấy token từ Headers
        const authHeader = req.headers['authorization']; // Có dạng: Bearer <token>
        const token = authHeader && authHeader.split(' ')[1]; //[1] lấy <token>
        if (!token) {
            return res.status(401).json({ message: 'Không tìm thấy access token' })
        }

        // xác thực token hợp lệ
        jwt.verify(token, process.env.ACCESS_TOKEN, async (err, decodedUser) => {
            if (err) {
                console.error(err);
                return res.status(403).json({ message: 'Access token hết hạn hoặc không đúng' });
            }

            //Tìm user 
            const user = await User.findById(decodedUser.userId).select('-password_hash');//lấy toàn bộ thông tin user trừ pass
            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại!' });
            }

            //Trả user về trong req
            req.user = user;
            //Không có lỗi gì 
            next();
        })
    } catch (error) {
        console.error('Lỗi khi xác minh JWT trong authMiddleware:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' })
    }
}