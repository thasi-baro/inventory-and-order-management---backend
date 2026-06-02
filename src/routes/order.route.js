import express from 'express';
import { createOrder, deleteOrder, getAllOrders, getOrder, updateOrderStatus } from '../controllers/order.controller.js';

const router = express.Router();

router.get('/',getAllOrders);
router.get('/:id',getOrder);
router.post('/',createOrder);
router.put('/:id',updateOrderStatus);
router.delete('/:id',deleteOrder)

export default router;