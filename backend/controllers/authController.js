// controllers/authController.js — Autentikasi (Register, Login, Me, Update Profil)
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db        = require('../config/db');

// ── Helper: generate JWT
const signToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ── Helper: format user response (tanpa password)
const formatUser = (row) => ({
  id:         row.id,
  fullname:   row.fullname,
  username:   row.username,
  email:      row.email,
  phone:      row.phone,
  gender:     row.gender,
  avatar_url: row.avatar_url,
  saldo:      row.saldo,
  created_at: row.created_at,
});

// ============================================================
// POST /api/auth/register
// ============================================================
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { fullname, username, email, phone, gender, password } = req.body;

  try {
    // Cek duplikasi email / username
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Email atau username sudah digunakan.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user baru
    const result = await db.query(
      `INSERT INTO users (fullname, username, email, phone, gender, password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [fullname, username, email, phone || null, gender || null, hashedPassword]
    );

    const userId = result.rows[0].id;

    // Buat cart kosong untuk user baru
    await db.query('INSERT INTO carts (user_id) VALUES ($1)', [userId]);

    // Generate token
    const token = signToken(userId, email);

    // Ambil data user lengkap
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Selamat datang di LaperCuy.',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[authController.register]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// POST /api/auth/login
// ============================================================
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const token = signToken(user.id, user.email);

    return res.json({
      success: true,
      message: `Selamat datang kembali, ${user.fullname.split(' ')[0]}!`,
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// GET /api/auth/me   [protected]
// ============================================================
exports.getMe = async (req, res) => {
  try {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    return res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    console.error('[authController.getMe]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// PUT /api/auth/profile   [protected]
// ============================================================
exports.updateProfile = async (req, res) => {
  const { fullname, phone, gender, avatar_url } = req.body;

  try {
    await db.query(
      `UPDATE users SET fullname = $1, phone = $2, gender = $3, avatar_url = $4
       WHERE id = $5`,
      [fullname, phone || null, gender || null, avatar_url || null, req.user.id]
    );

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[authController.updateProfile]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// POST /api/auth/topup   [protected]
// ============================================================
exports.topUp = async (req, res) => {
  const amount = parseInt(req.body.amount) || 50000;

  try {
    await db.query('UPDATE users SET saldo = saldo + $1 WHERE id = $2', [amount, req.user.id]);
    const userResult = await db.query('SELECT saldo FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    return res.json({
      success: true,
      message: `✓ Berhasil Top Up SaldoCuy Rp ${amount.toLocaleString('id-ID')}!`,
      saldo: user.saldo,
    });
  } catch (err) {
    console.error('[authController.topUp]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};
