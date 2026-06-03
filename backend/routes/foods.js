// routes/foods.js
const express  = require('express');
const foodCtrl = require('../controllers/foodController');
const auth     = require('../middleware/auth');

const router = express.Router();

// GET  /api/foods          — publik (tidak butuh login)
router.get('/',        foodCtrl.getAllFoods);

// GET  /api/foods/:foodId  — publik
router.get('/:foodId', foodCtrl.getFoodById);

// POST   /api/foods        — protected (admin)
router.post('/',          auth, foodCtrl.createFood);

// PUT    /api/foods/:id    — protected (admin)
router.put('/:foodId',    auth, foodCtrl.updateFood);

// DELETE /api/foods/:id    — protected (admin)
router.delete('/:foodId', auth, foodCtrl.deleteFood);

module.exports = router;
