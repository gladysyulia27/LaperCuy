// controllers/foodController.js — Manajemen Menu Makanan
const db = require('../config/db');

// ============================================================
// GET /api/foods
// Query: ?category=nasi&tag=populer&price_max=20000
// ============================================================
exports.getAllFoods = async (req, res) => {
  try {
    const { category, tag, price_max } = req.query;

    let query = 'SELECT * FROM foods WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (category && category !== 'all') {
      query += ` AND category = $${paramIdx++}`;
      params.push(category);
    }

    if (tag && tag !== 'all') {
      // 'populer' tab juga include 'terdekat' (sesuai logika frontend)
      if (tag === 'populer') {
        query += ` AND (tag = $${paramIdx++} OR tag = $${paramIdx++})`;
        params.push('populer', 'terdekat');
      } else {
        query += ` AND tag = $${paramIdx++}`;
        params.push(tag);
      }
    }

    if (price_max) {
      query += ` AND price <= $${paramIdx++}`;
      params.push(parseInt(price_max));
    }

    query += ' ORDER BY sold_count DESC';

    const result = await db.query(query, params);
    const foods = result.rows;

    return res.json({ success: true, count: foods.length, foods });
  } catch (err) {
    console.error('[foodController.getAllFoods]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// GET /api/foods/:foodId
// ============================================================
exports.getFoodById = async (req, res) => {
  try {
    const foodId = req.params.foodId;
    const isNum = /^\d+$/.test(foodId);

    let query = 'SELECT * FROM foods WHERE food_id = $1';
    const params = [foodId];

    if (isNum) {
      query += ' OR id = $2';
      params.push(parseInt(foodId));
    }

    const result = await db.query(query, params);
    const food = result.rows[0];

    if (!food) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    }

    return res.json({ success: true, food });
  } catch (err) {
    console.error('[foodController.getFoodById]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// POST /api/foods   [protected — admin only]
// ============================================================
exports.createFood = async (req, res) => {
  const { food_id, name, price, category, sold_count, sold_label, img, badge, tag, description, is_available } = req.body;

  if (!food_id || !name || !price || !category) {
    return res.status(400).json({ success: false, message: 'food_id, name, price, category wajib diisi.' });
  }

  try {
    // Cek duplikasi food_id
    const existResult = await db.query('SELECT id FROM foods WHERE food_id = $1', [food_id]);
    const exist = existResult.rows[0];
    if (exist) {
      return res.status(409).json({ success: false, message: 'food_id sudah digunakan.' });
    }

    const result = await db.query(
      `INSERT INTO foods (food_id, name, price, category, sold_count, sold_label, img, badge, tag, description, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        food_id, name, parseInt(price), category,
        parseInt(sold_count) || 0,
        sold_label || null,
        img || 'assets/default.png',
        badge || null,
        tag || 'populer',
        description || null,
        is_available !== undefined ? (is_available === true || is_available === 'true' || is_available === 1) : true,
      ]
    );

    const insertId = result.rows[0].id;
    const foodResult = await db.query('SELECT * FROM foods WHERE id = $1', [insertId]);
    const food = foodResult.rows[0];

    return res.status(201).json({ success: true, message: 'Menu berhasil ditambahkan.', food });
  } catch (err) {
    console.error('[foodController.createFood]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// PUT /api/foods/:foodId   [protected — admin only]
// ============================================================
exports.updateFood = async (req, res) => {
  const { name, price, category, sold_count, sold_label, img, badge, tag, description, is_available } = req.body;
  const foodId = req.params.foodId;

  try {
    const isNum = /^\d+$/.test(foodId);
    let selectQuery = 'SELECT id FROM foods WHERE food_id = $1';
    const selectParams = [foodId];

    if (isNum) {
      selectQuery += ' OR id = $2';
      selectParams.push(parseInt(foodId));
    }

    const existResult = await db.query(selectQuery, selectParams);
    const food = existResult.rows[0];

    if (!food) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    }

    await db.query(
      `UPDATE foods
       SET name=$1, price=$2, category=$3, sold_count=$4, sold_label=$5, img=$6,
           badge=$7, tag=$8, description=$9, is_available=$10
       WHERE id=$11`,
      [
        name, parseInt(price), category,
        parseInt(sold_count) || 0,
        sold_label || null,
        img,
        badge || null,
        tag || 'populer',
        description || null,
        is_available === true || is_available === 'true' || is_available === 1,
        food.id,
      ]
    );

    const updatedResult = await db.query('SELECT * FROM foods WHERE id = $1', [food.id]);
    const updated = updatedResult.rows[0];

    return res.json({ success: true, message: 'Menu berhasil diperbarui.', food: updated });
  } catch (err) {
    console.error('[foodController.updateFood]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// DELETE /api/foods/:foodId   [protected — admin only]
// ============================================================
exports.deleteFood = async (req, res) => {
  const foodId = req.params.foodId;
  try {
    const isNum = /^\d+$/.test(foodId);
    let selectQuery = 'SELECT id, name FROM foods WHERE food_id = $1';
    const selectParams = [foodId];

    if (isNum) {
      selectQuery += ' OR id = $2';
      selectParams.push(parseInt(foodId));
    }

    const existResult = await db.query(selectQuery, selectParams);
    const food = existResult.rows[0];

    if (!food) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    }

    await db.query('DELETE FROM foods WHERE id = $1', [food.id]);

    return res.json({ success: true, message: `Menu "${food.name}" berhasil dihapus.` });
  } catch (err) {
    console.error('[foodController.deleteFood]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};
