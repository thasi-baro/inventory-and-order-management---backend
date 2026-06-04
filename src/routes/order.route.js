import express from 'express';
import { createOrder, getAllOrders, getStats, updateOrderStatus } from '../controllers/order.controller.js';

const router = express.Router();

router.get('/', getAllOrders);
router.post('/', createOrder);
router.get('/stats', getStats)
router.patch('/:id', updateOrderStatus);

export default router;