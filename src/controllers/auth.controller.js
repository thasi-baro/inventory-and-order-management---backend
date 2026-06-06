import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User.js';
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';
import Session from '../models/Session.js';

//Biến lưu thời gian hết hạn 
const ACCESS_TOKEN_TTL = '30m' // 30 phut
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; //14 ngày

/**
 * Hàm đăng ký 
 * @route POST /api/auth/sign-up
 * @param {*} req.body - Lấy username, password và email từ req cho người dùng nhập 
 * @param {*} res 
 * @returns - Thông báo đăng ký thành công
 */
export const signUp = async (req, res) => {
    try {
        const { username, password, email } = req.body;
        //Kiểm tra truyền thiếu thông tin 
        if (!username || !password || !email) {
            return res.status(400).json({ message: 'Thiếu thông tin đăng ký' })//trả lỗi 400
        }

        //Kiểm tra độ mạnh mật khẩu (level đơn giản)
        if (password.length < 6) {
            return res.status(400).json({ message: 'Vui lòng chọn mật khẩu dài hơn 6 kí tự' })
        }

        //Kiểm tra email có tồn tại chưa
        const duplicate = await User.findOne({ email });
        if (duplicate) {
            return res.status(409).json({ message: 'Email đã tồn tại' });// trả lỗi 409
        }

        //Mã hóa pass
        const hashedPass = await bcrypt.hash(password, 10); // salt = 10

        //Tạo user 
        await User.create({
            username,
            email,
            password_hash: hashedPass
        })

        //Trả về trạng thái tạo user thành công 
        return res.status(201).json({ message: 'Đăng ký tài khoản thành công' });

    } catch (error) {
        console.error('Lỗi khi gọi sign up:', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
}

/**
 * Hàm đăng nhập - kiểm tra mật khẩu người dùng, lưu token
 * @route POST /api/auth/sign-in
 * @param {*} req.body - Lấy password và email từ req.body người dùng nhập
 * @param {*} res 
 * @returns Access token
 */
export const signIn = async (req, res) => {
    try {
        const { password, email } = req.body;
        //Kiểm tra truyền thiếu thông tin 
        if (!password || !email) {
            return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' })//trả lỗi 400
        }

        const user = await User.findOne({ email });
        if (!user) {//Kiểm tra user tồn tại
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' })
        }

        //Lấy hashedPass trong db và ss với pass người dùng nhập
        const passCorrect = await bcrypt.compare(password, user.password_hash);

        if (!passCorrect) {//Nếu sai pass
            return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" })
        }
        //Nếu khớp, tạo accessToken với JWT
        const accessToken = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN, { expiresIn: ACCESS_TOKEN_TTL })
        // Tạo refresh token
        const refreshToken = crypto.randomBytes(64).toString('hex');
        //Tạo session mới để lưu refresh token
        await Session.create({
            userId: user._id,
            refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL)// đặt thời gian hết hạn của refresh token (14 ngày)
        });
        // Trả refresh token về cookie
        const isProduction = process.env.NODE_ENV === "production";

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction, // Tự động false ở localhost, true ở production
            sameSite: isProduction ? 'none' : 'strict', // Tự động thay đổi theo môi trường
            maxAge: REFRESH_TOKEN_TTL
        });
        //trả access token 
        return res.status(200).json({ message: `User ${user.username} đã đăng nhập`, accessToken });
    } catch (error) {
        console.error('Lỗi khi gọi sign in  :', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
}

/**
 * Đăng xuất
 * @route POST /api/auth/sign-out
 * @param {*} req.cookie - Refresh token từ req.cookie
 * @param {*} res 
 * @returns - Trạng thái đăng xuất thành công
 */
export const signOut = async (req, res) => {
    try {
        //Lấy refresh token từ cookie
        const token = req.cookies?.refreshToken; //nhờ cookie parser

        if (token) {//Nếu có token
            // xóa refresh token trong session
            await Session.deleteOne({ refreshToken: token });

            //xóa cookie
            res.clearCookie('refreshToken')
        }
        return res.sendStatus(204);
    } catch (error) {
        console.error('Lỗi khi gọi sign out:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' })
    }
}

/**
 * Kiểm tra session và tạo access token mới
 * @route POST /api/auth/refresh
 * @param {*} req - token từ req.cookie
 * @param {*} res 
 * @returns access token
 */
export const refreshToken = async (req, res) => {
    try {
        //lấy refresh token mới từ cookie
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ messasge: 'Token không tồn tại' })
        }
        // so với refresh token trong db
        const session = await Session.findOne({ refreshToken: token });
        if (!session) {
            return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn' })
        }
        //kiểm tra hết hạn
        if (session.expiresAt < new Date()) {
            return res.status(403).json({ message: 'Token đã hết hạn' })
        }
        //tạo access token mới
        const accessToken = jwt.sign({
            userId: session.userId
        }, process.env.ACCESS_TOKEN, { expiresIn: ACCESS_TOKEN_TTL })
        //trả accessoken mới
        return res.status(200).json({ accessToken })
    } catch (error) {
        console.error('Lỗi khi gọi refreshToken:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' })
    }
}