import express from 'express';
import { authMe, updateUserSetting } from '../controllers/user.controller.js';

const router = express.Router();
//Lấy thông tin user đang đăng nhập
router.get('/me', authMe);
//cập nhật username và threshold
router.put('/', updateUserSetting)
export default router;