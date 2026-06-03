// routes/orders.js
const express    = require('express');
const orderCtrl  = require('../controllers/orderController');
const auth       = require('../middleware/auth');

const router = express.Router();

// Semua route order memerlukan autentikasi
router.use(auth);

// GET  /api/orders/active    — pesanan aktif (harus sebelum /:id)
router.get('/active',  orderCtrl.getActiveOrder);

// GET  /api/orders           — riwayat semua pesanan
router.get('/',        orderCtrl.getOrders);

// POST /api/orders           — buat pesanan baru
router.post('/',       orderCtrl.createOrder);

// GET  /api/orders/:id       — detail satu pesanan
router.get('/:id',     orderCtrl.getOrderById);

module.exports = router;
