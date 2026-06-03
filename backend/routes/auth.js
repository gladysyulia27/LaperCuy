// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const authCtrl = require('../controllers/authController');
const auth     = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
  body('fullname').trim().notEmpty().withMessage('Nama lengkap wajib diisi.'),
  body('username').trim().notEmpty().isLength({ min: 3 }).withMessage('Username minimal 3 karakter.')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username hanya boleh huruf, angka, dan underscore.'),
  body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid.'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.'),
], authCtrl.register);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid.'),
  body('password').notEmpty().withMessage('Password wajib diisi.'),
], authCtrl.login);

// GET /api/auth/me  [protected]
router.get('/me', auth, authCtrl.getMe);

// PUT /api/auth/profile  [protected]
router.put('/profile', auth, authCtrl.updateProfile);

// POST /api/auth/topup  [protected]
router.post('/topup', auth, authCtrl.topUp);

module.exports = router;
