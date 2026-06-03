// routes/cart.js
const express  = require('express');
const cartCtrl = require('../controllers/cartController');
const auth     = require('../middleware/auth');

const router = express.Router();

// Semua route cart memerlukan autentikasi
router.use(auth);

// GET    /api/cart              — isi keranjang
router.get('/',              cartCtrl.getCart);

// POST   /api/cart/add          — tambah item
router.post('/add',          cartCtrl.addItem);

// PUT    /api/cart/item/:itemId  — ubah qty/note item
router.put('/item/:itemId',  cartCtrl.updateItem);

// DELETE /api/cart/item/:itemId  — hapus satu item
router.delete('/item/:itemId', cartCtrl.removeItem);

// DELETE /api/cart               — kosongkan keranjang
router.delete('/',           cartCtrl.clearCart);

module.exports = router;
