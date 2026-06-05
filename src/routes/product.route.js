import express from 'express';
import { createProduct, deleteProduct, getAllProducts, getProduct, getTotalAndLowProduct, updateProduct } from '../controllers/product.controller.js';
import { upload } from '../config/cloudinary.js';
const router = express.Router();

//single để upload trường image lên cloudinary
router.post('/', upload.single('image'), createProduct);
router.get('/', getAllProducts);
router.get('/count', getTotalAndLowProduct);
router.get('/:id', getProduct);
router.put('/:id', upload.single('image'), updateProduct);
router.delete('/:id', deleteProduct);
export default router;