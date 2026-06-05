import Product from "../models/Product.js";
import mongoose from "mongoose";
import { redis } from '../config/redis.js'
import User from "../models/User.js";
/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 * @param   {Object} req - Request object chứa body và thông tin user
 * @param   {Object} res - Response object
 * @returns {Object} Trạng thái và dữ liệu sản phẩm vừa tạo
 */
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        const userId = req.user._id;

        // Rào chắn dữ liệu đầu vào bắt buộc
        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Vui lòng nhập tên và giá sản phẩm' });
        }
        //Lấy URL ảnh từ Cloudinary
        let image_url = '';
        if (req.file) {
            image_url = req.file.path; // ink ảnh trả về từ Cloudinary
        }
        // Tạo DB Document (ID user được gắn cứng từ token để chống giả mạo)
        const product = await Product.create({
            user: userId,
            name,
            description,
            price,
            stock: stock || 0,
            image_url
        });
        //Xóa dữ liệu redis hiện tại vì có thay đổi
        await redis.del(`dashboard_stats_${userId}`);
        return res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
    } catch (error) {
        console.error('Lỗi khởi tạo sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Lấy danh sách toàn bộ sản phẩm của user hiện tại (phân trang và lọc theo giá cũng như trạng thái)
 * @route   GET /api/products
 * @param   {Object} req 
 * @param   {Object} res 
 * @returns {Object} Mảng danh sách sản phẩm
 */
export const getAllProducts = async (req, res) => {
    try {
        const userId = req.user._id;
        //Lấy ngưỡng hết hàng mà user muốn
        const currentUser = await User.findById(userId);
        const threshold = currentUser.lowStockThreshold || 10;
        //Phân trang
        const page = parseInt(req.query.page) || 1;       // Mặc định trang 1
        const limit = parseInt(req.query.limit) || 5;     // Mặc định 5 sp/trang
        const search = req.query.search || "";            // Mặc định ko tìm kiếm
        const status = req.query.status || "ALL";         // Mặc định lấy tất cả
        const fromPirce = parseInt(req.query.fromPrice) || 0;
        const toPrice = parseInt(req.query.toPrice) || 1000000000; //mặc định từ 0 đến dưới 1 ty
        //Biến điều kiện lọc
        const query = { user: userId }//Chỉ lấy những sản phẩm của user đó
        //Nếu có search -> Tìm theo tên dùng $option {"i"} (ko phân biệt hoa thường)
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        //Lọc theo trạng thái stock
        if (status === 'IN_STOCK') {
            query.stock = { $gte: threshold }//Sl > threshold
        } else if (status === 'LOW_STOCK') {
            query.stock = { $lt: threshold, $gt: 0 }//sl >0 & < threshold
        } else if (status === 'OUT_OF_STOCK') {
            query.stock = 0
        }

        //Lọc theo khoảng giá
        query.price = { $gte: fromPirce, $lte: toPrice }
        //Tính trang bỏ qua (skip)
        const skipIndex = (page - 1) * limit;
        const [products, totalProducts] = await Promise.all([
            Product.find(query)
                .sort({ createdAt: -1 })//Xếp sản phẩm mới tạo lên trên
                .skip(skipIndex)//Bỏ qua n sản phẩm
                .limit(limit)//Giới hạn 5 sản phẩm
                .lean(), //lean chỉ dùng những hàm cần thiết cải thiện tốc độ đọc

            //Lấy tổng số lượng sản phẩm để tính toán
            Product.countDocuments(query)
        ]);

        if (totalProducts === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào' });
        }

        return res.status(200).json({
            products: products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalProducts / limit), //Làm tròn lên 
                totalItems: totalProducts,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Lỗi truy xuất danh sách sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Lấy thông tin chi tiết một sản phẩm
 * @route   GET /api/products/:id
 * @param   {Object} req 
 * @param   {Object} res 
 * @returns {Object} Chi tiết 1 sản phẩm
 */
export const getProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        const productId = req.params.id;
        //Kiểm tra định dạng product id tránh lỗi thiếu hoặc dư ký tự CastError trong Mongo
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Định dạng ID sản phẩm không hợp lệ' });
        }
        // Khớp cả user và productId để chặn lỗi IDOR
        const product = await Product.findOne({ user: userId, _id: productId }).lean();

        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        return res.status(200).json({ product });
    } catch (error) {
        console.error('Lỗi truy xuất chi tiết sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Cập nhật thông tin sản phẩm
 * @route   PUT /api/products/:id
 * @param   {Object} req 
 * @param   {Object} res 
 * @returns {Object} Sản phẩm sau khi cập nhật
 */
export const updateProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        const productId = req.params.id;
        //Kiểm tra định dạng product id tránh lỗi thiếu hoặc dư ký tự CastError trong Mongo
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Định dạng ID sản phẩm không hợp lệ' });
        }

        //Lưu body gửi từ req vào biến
        const updatedData = { ...req.body }

        if (req.file) {//Nếu có ảnh thì mới update image_url
            updatedData.image_url = req.file.path;
        }
        // Cập nhật và ép Mongoose trả về bản mới (new), chặn giá trị âm (runValidators)
        const product = await Product.findOneAndUpdate(
            { user: userId, _id: productId },
            updatedData,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
        }
        //Xóa dữ liệu redis hiện tại vì có thay đổi
        await redis.del(`dashboard_stats_${userId}`);
        return res.status(200).json({ message: 'Cập nhật thành công', product });
    } catch (error) {
        console.error('Lỗi cập nhật sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Xóa vĩnh viễn một sản phẩm
 * @route   DELETE /api/products/:id
 * @param   {Object} req 
 * @param   {Object} res 
 * @returns {Object} Message thông báo
 */
export const deleteProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        const productId = req.params.id;
        //Kiểm tra định dạng product id tránh lỗi thiếu hoặc dư ký tự CastError trong Mongo
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Định dạng ID sản phẩm không hợp lệ' });
        }
        const product = await Product.findOneAndDelete({ user: userId, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
        }
        //Xóa dữ liệu redis hiện tại vì có thay đổi
        await redis.del(`dashboard_stats_${userId}`);
        return res.status(200).json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
        console.error('Lỗi xóa sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};
/**
 * Đếm số lượng tổng và sản phẩm còn ít hơn 10
 * @param {*} req 
 * @param {*} res 
 * @returns total và (stock < 10)
 */
export const getTotalAndLowProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        //Lấy ngưỡng hết hàng mà user tùy chỉnh
        const currentUser = await User.findById(userId);
        const threshold = currentUser.lowStockThreshold;
        //Lấy tổng và sản phẩm còn stock < threshol
        const [totalProducts, lowStockProduct] = await Promise.all([
            Product.countDocuments({ user: userId }),//tổng sp
            Product.countDocuments({ user: userId, stock: { $lt: threshold, $gt: 0 } })//Lấy sl > 0 và < 10
        ]);

        res.status(200).json({
            total: totalProducts,
            lowStock: lowStockProduct
        })
    } catch (error) {
        console.error('Lỗi khi gọi get total and low product');
        res.status(500).json({ message: 'Lỗi hệ thống' });
    }
}