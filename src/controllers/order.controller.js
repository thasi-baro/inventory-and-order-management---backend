import Order from "../models/Order.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import { redis } from '../config/redis.js';
import { sendOrderConfirmationEmail } from "../config/sendMail.js";
import User from '../models/User.js'
/**
 * @desc    Tạo đơn hàng mới (Đặt hàng) an toàn với Transaction (có gửi mail)
 * @route   POST /api/orders
 * @param   {Object} req - Chứa mảng items [{ product, quantity }]
 * @returns {Object} order - Đơn  hàng vừa đặt 
 */
export const createOrder = async (req, res) => {
    // Khởi tạo Transaction tránh cập nhật số lượng và bị lỗi 
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { items, customerInfo } = req.body;
        const userId = req.user._id;
        //Validate items
        if (!items || items.length === 0) {
            await session.abortTransaction(); // Hủy session trước khi return
            return res.status(400).json({ message: 'Giỏ hàng của bạn đang trống' });
        }

        // Validate thông tin khách hàng 
        if (!customerInfo || !customerInfo.name || !customerInfo.email) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên và email khách hàng' });
        }
        let total_amount = 0;
        const validOrderItems = [];

        // Validate items
        for (const item of items) {
            const product = await Product.findById(item.product).session(session);

            if (!product) {
                await session.abortTransaction();// Hủy session trước khi return
                return res.status(404).json({ message: `Sản phẩm ID ${item.product} không tồn tại` });
            }

            if (product.stock < item.quantity) {
                await session.abortTransaction();// Hủy session trước khi return
                return res.status(400).json({
                    message: `Sản phẩm "${product.name}" không đủ số lượng. Kho chỉ còn ${product.stock}`
                });
            }

            //Tính tổng tiền
            total_amount += (product.price * item.quantity);

            //Lưu để lát trừ số lượng  product
            validOrderItems.push({
                product: product._id,
                quantity: item.quantity,
                unit_price: product.price
            });
        }

        //Tạo mã đơn (lấy 6 số cuối của thời gian hiện tại)
        const orderCode = 'ORD-' + Date.now().toString().slice(-6);

        // Tạo đơn hàng
        const newOrders = await Order.create([{
            user: userId,
            items: validOrderItems,
            total_amount,
            orderCode,
            customerInfo
        }], { session });

        const order = newOrders[0]; // Lấy đơn hàng vừa tạo từ mảng trả về


        // Trừ số lượng tồn kho và lấy thông tin sản phẩm để gửi mail
        const emailItemsDetails = []//Mảng chứa thông tin các sp để gửi mail
        for (const item of validOrderItems) {
            //Trừ tồn kho
            const updatedProduct = await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: -item.quantity } },
                { session, new: true }
            );
            //Lấy tên sp
            if (updatedProduct) {
                emailItemsDetails.push({
                    name: updatedProduct.name,
                    quantity: item.quantity,
                    price: item.unit_price
                })
            }
        }

        // Thông tin đơn đặt hàng để gửi mail
        const emailData = {
            orderCode: order.orderCode || order._id,
            customerName: customerInfo.name,
            items: emailItemsDetails,
            total_amount: total_amount
        };

        sendOrderConfirmationEmail(customerInfo.email, emailData); // Gửi mail cùng với dữ liệu vừa lấy được

        // Khôn có lỗi -> lưu mọi update Database
        await session.commitTransaction();
        //Xóa dữ liệu redis hiện tại vì có thay đổi để dashboard luôn có dữ liệu mới nhất
        await redis.del(`dashboard_stats_${userId}`);

        return res.status(201).json({ message: 'Đặt hàng thành công', order });

    } catch (error) {
        // Có lỗi -> hủy (Rollback)
        await session.abortTransaction();
        console.error('Lỗi khi create order:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });

    } finally {
        // Dù thành công hay thất bại, đóng Session giải phóng RAM
        session.endSession();
    }
};

/**
 * @desc    Lấy lịch sử đơn hàng của user (phân trang và lọc theo trạng thái)
 * @route   GET /api/orders
 * @returns Danh sách đơn hàng
 */
export const getAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;       // Mặc định trang 1
        const limit = parseInt(req.query.limit) || 5;     // Mặc định 5 sp/trang
        const status = req.query.status || "ALL";

        //Biến điều kiện lọc
        const query = { user: userId }//Chỉ lấy những sản phẩm của user đó

        //Lọc theo trạng thái
        if (status === 'PENDING') {
            query.status = 'pending'
        } else if (status === 'COMPLETED') {
            query.status = 'completed'
        } else if (status === 'CANCELLED') {
            query.status = 'cancelled'
        }

        //Tính trang bỏ qua (skip)
        const skipIndex = (page - 1) * limit;
        // Dùng .populate() để kéo thêm tên và ảnh từ bảng Product sang
        // Dùng .sort({ createdAt: -1 }) để đưa đơn hàng mới nhất lên đầu
        const [orders, totalOrders] = await Promise.all([
            Order.find(query)
                .populate('items.product', 'name image_url')
                .sort({ createdAt: -1 })
                .skip(skipIndex)
                .limit(limit)
                .lean(),//Do chỉ đọc nên dùng lean để tăng tốc độ

            Order.countDocuments(query)
        ])

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng nào' });
        }

        return res.status(200).json({
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
                totalItems: totalOrders,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Lỗi gọi get all order:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Cập nhật trạng thái đơn hàng (Thường dùng để Hủy đơn)
 * @route   PATCH /api/orders/:id   
 * @returns Đơn hàng sau khi cập nhật
 */
export const updateOrderStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const orderId = req.params.id;

        // Kiểm tra định dạng ID
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Định dạng ID đơn hàng không hợp lệ' });
        }

        const { newStatus } = req.body;
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ' });
        }

        // Tìm đơn hàng
        const order = await Order.findOne({ user: userId, _id: orderId });

        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng để cập nhật' });
        }

        // Hoàn số lượng: cộng lại số lượng sản phẩm trong kho khi đơn hàng bị hủy
        if (newStatus === 'cancelled' && order.status !== 'cancelled') {
            for (const item of order.items) {
                const productId = item.product._id || item.product;

                await Product.findOneAndUpdate(
                    { _id: productId, user: userId },
                    { $inc: { stock: item.quantity } }
                );
            }
        }

        order.status = newStatus;//Cập nhật trạng thái đơn hàng
        await order.save(); //Lưu vào db

        await redis.del(`dashboard_stats_${userId}`); //Xóa redis cache để dashboard luôn có dữ liệu mới nhất

        return res.status(200).json({ message: 'Cập nhật trạng thái thành công', order });

    } catch (error) {
        console.error('Lỗi khi gọi update order:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

//hàm tính doanh thu theo tháng
const calculateRevenue = async (startDate, endDate, userId) => {
    const result = await Order.aggregate([
        {
            $match: {
                user: userId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: "completed", //Chỉ cộng tiền những đơn đã hoàn thành
            },
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$total_amount" }, // Cộng dồn cột total_amount
            },
        },
    ]);

    // Nếu không có đơn nào trả về mặc định là 0
    return result.length > 0 ? result[0].totalRevenue : 0;
};

/**
 * @desc  Lấy dữ liệu trang thống kê
 * @route   GET /api/orders/stats
*@returns Các biến thống kê
*/
export const getStats = async (req, res) => {
    try {
        const userId = req.user._id;
        //Lấy ngưỡng hết hàng mà user tùy chỉnh
        const currentUser = await User.findById(userId);
        const threshold = currentUser.lowStockThreshold;
        // Lưu dữ liệu vào Redis vì API mỗi lần gọi lấy dữ liệu lớn
        const cachedKey = `dashboard_stats_${userId}`
        //Tính doanh thu tháng và so với tháng trước
        const now = new Date();
        const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);//Ngày đầu tiên của tháng này
        const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);//Ngày đầu tiên của tháng trước
        //Ngày cuối của tháng trước (0 của tháng hiện tại sẽ là ngày cuois tháng trước)
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        //Lấy 30 ngày vừa qua
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        //Lấy ngày và doanh thu của ngày đó trong 30 ngày vừa qua với trạng thái những đơn đã completed
        const getRevenueOverTime = await Order.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo }, status: "completed", user: userId } },
            {
                $group: {
                    // Gom nhóm theo định dạng ngày YYYY-MM-DD
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$total_amount" }
                }
            },
            { $sort: { _id: 1 } } // Sắp xếp theo ngày tăng dần 
        ]);

        // Lấy dữ liệu Biểu đồ Tròn 
        const getOrderStatusBreakdown = await Order.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: "$status", // Gom nhóm theo chữ "pending", "completed", "cancelled"
                    count: { $sum: 1 } // Đếm số lượng
                }
            }
        ]);
        // Lấy Top 5 Sản phẩm bán chạy nhất trong tháng
        const getTopSellingProducts = await Order.aggregate([
            // Chỉ lấy đơn hàng tháng này và không bị hủy
            { $match: { createdAt: { $gte: startThisMonth }, status: { $ne: "cancelled" }, user: userId } },
            // Tách mảng items ra thành từng dòng riêng biệt để dễ đếm
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product", // Gom theo ID sản phẩm
                    totalSold: { $sum: { $toInt: "$items.quantity" } } // Cộng dồn số lượng bán ra
                }
            },
            { $sort: { totalSold: -1 } }, // Sắp xếp bán nhiều nhất lên đầu
            { $limit: 5 }, //Lấy 5 sản phẩm
            // JOIN với bảng Product để lấy tên product
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    name: "$productDetails.name",
                    totalSold: 1,
                    _id: 0
                }
            }
        ]);

        //Lấy số lượng sản phẩm tồn kho
        const getInventoryHealth = await Product.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    inStock: { $sum: { $cond: [{ $gt: ["$stock", threshold] }, 1, 0] } },
                    lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", threshold] }] }, 1, 0] } },
                    outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } }
                }
            }
        ]);
        //Chạy song song các lệnh gọi xuống db để tối ưu hiệu suất
        const [
            thisMonthRevenue,
            lastMonthRevenue,
            totalOrders,
            totalProducts,
            revenueOverTimeData,
            statusBreakdownData,
            topProductsData,
            inventoryHealth
        ] = await Promise.all([
            calculateRevenue(startThisMonth, now, userId),
            calculateRevenue(startLastMonth, endLastMonth, userId),
            Order.countDocuments({ user: userId }),
            Product.countDocuments({ user: userId }),
            getRevenueOverTime,
            getOrderStatusBreakdown,
            getTopSellingProducts,
            getInventoryHealth
        ]);

        //Tính phần trăm tăng/giảm
        let percentage = 0
        if (lastMonthRevenue > 0) {
            percentage = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100; //Tính phần trăm tăng trưởng (có thể âm)
        } else if (lastMonthRevenue === 0 && thisMonthRevenue > 0) {
            percentage = 100//Nếu tháng trước ko có doanh thu thì tháng này tăng 100%
        }
        percentage = Math.round(percentage * 100) / 100 //Làm tròn 2 chữ số thập phân

        //format dữ liệu status để fe dễ xử lí
        const formattedStatus = statusBreakdownData.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, { pending: 0, completed: 0, cancelled: 0 });
        //format dữ liệu inventory để fe dễ xử lí
        const formattedInventoryHealth = inventoryHealth.length > 0
            ? inventoryHealth[0]
            : { inStock: 0, lowStock: 0, outOfStock: 0 }
        const data = {
            totalOrders,
            totalProducts,
            thisMonthRevenue,
            percentage,
            revenueOverTime: revenueOverTimeData, // return: [ { _id: "2026-06-01", revenue: 1500 }, ... ]
            orderStatusBreakdown: formattedStatus, // return: { pending: 15, completed: 80, cancelled: 5 }
            topProducts: topProductsData,           // return: [ { name: "MacBook", totalSold: 12 }, ... ]
            inventoryHealth: formattedInventoryHealth // return: {_id, inStock: 5, lowStock: 0, outOfStock: 2}
        }

        //Luư dữ liệu vào Redis nếu ko có lỗi, ex:300 (5 phút)
        await redis.set(cachedKey, data, { ex: 300 })
        return res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Lỗi khi gọi get order:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};