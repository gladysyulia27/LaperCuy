// server.js — LaperCuy Backend Entry Point
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const foodRoutes = require('./routes/foods');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

// Init DB connection (side-effect on require)
require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({
    limit: '10mb'
})); // parse JSON bodies (incl. base64 avatar)
app.use(express.urlencoded({
    extended: true
}));

// ── Static Files: serve frontend HTML/CSS/JS/assets ────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'LaperCuy API is running! 🍛',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// ── SPA Fallback: semua route non-API arahkan ke index.html ─
app.get('*', (req, res) => {
    // Jika request adalah API, kembalikan 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'Endpoint tidak ditemukan.'
        });
    }
    // Untuk halaman frontend, cek apakah file ada, jika tidak ke index
    const filePath = path.join(frontendPath, req.path);
    res.sendFile(filePath, err => {
        if (err) res.sendFile(path.join(frontendPath, 'index.html'));
    });
});

// ── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Unhandled Error]', err);
    res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan internal server.'
    });
});

// ── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('  🍛  LaperCuy Backend Server');
    console.log('  ─────────────────────────────────────');
    console.log(`  🌐  URL      : http://localhost:${PORT}`);
    console.log(`  🌐  LOGIN    : http://localhost:${PORT}/login.html`);
    console.log(`  🌐  REGISTER : http://localhost:${PORT}/register.html`);
    console.log(`  📡  API      : http://localhost:${PORT}/api`);
    console.log('  ─────────────────────────────────────');
    console.log('');
});

module.exports = app;