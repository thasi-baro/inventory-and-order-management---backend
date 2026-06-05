import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import authRoute from './routes/auth.route.js'
import userRoute from './routes/user.route.js'
import { protectedRoute } from './middleware/auth.middleware.js';
import productRoute from './routes/product.route.js'
import orderRoute from './routes/order.route.js';

const app = express();
const PORT = process.env.PORT || 5001

//middleware
app.use(express.json()); //sử dụng json
app.use(cookieParser());//đọc cookie
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true })); // kết nối với fe

//public routes
app.use('/api/auth', authRoute)

//private routes
app.use(protectedRoute)//Các route phía dưới điều phải qua route này (bắt buộc đã đăng nhập rồi)
app.use('/api/users', userRoute);
app.use('/api/products', productRoute)
app.use('/api/orders', orderRoute)
//kết nối db
connectDB().then(() => {//kết nối DB
    app.listen(PORT, () => {//chạy port 5001
        console.log('Server is running at PORT:', PORT);
    })
})
