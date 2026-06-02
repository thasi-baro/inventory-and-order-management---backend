import Product from "../models/Product.js";

/**
 * @desc    Tạo sản phẩm mới
 * @route   POST /api/products
 * @param   {Object} req - Request object chứa body và thông tin user
 * @param   {Object} res - Response object
 * @returns {Object} Trạng thái và dữ liệu sản phẩm vừa tạo
 */
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock, image_url } = req.body;
        const userId = req.user._id; 

        // Rào chắn dữ liệu đầu vào bắt buộc
        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Vui lòng nhập tên và giá sản phẩm' });
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

        return res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
    } catch (error) {
        console.error('Lỗi khởi tạo sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};

/**
 * @desc    Lấy danh sách toàn bộ sản phẩm của user hiện tại
 * @route   GET /api/products
 * @param   {Object} req 
 * @param   {Object} res 
 * @returns {Object} Mảng danh sách sản phẩm
 */
export const getAllProducts = async (req, res) => {
    try {
        const userId = req.user._id;

        // Dùng .lean() lấy object JS thuần túy giúp tối ưu tốc độ đọc
        const products = await Product.find({ user: userId }).lean();
        
        if (products.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào' });
        }

        return res.status(200).json({ products });
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

        // Cập nhật và ép Mongoose trả về bản mới (new), chặn giá trị âm (runValidators)
        const product = await Product.findOneAndUpdate(
            { user: userId, _id: productId },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
        }

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

        const product = await Product.findOneAndDelete({ user: userId, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
        }

        return res.status(200).json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
        console.error('Lỗi xóa sản phẩm:', error);
        return res.status(500).json({ message: 'Lỗi hệ thống' });
    }
};