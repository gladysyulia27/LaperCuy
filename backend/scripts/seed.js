const bcrypt = require('bcryptjs');
const db = require('../config/db');
require('dotenv').config();

const foods = [
  ['nasi_jeruk', 'Nasi Jeruk Special', 15000, 'nasi', 'assets/nasi_jeruk.png', 'Bestseller', 'populer', 'Aromatic lime rice with crispy chicken and sambal matah.', 25, 8],
  ['mie_rebus', 'Mie Rebus Seafood', 22000, 'mie', 'assets/mie_seafood.png', null, 'terbaru', 'Rich broth noodle with shrimp, calamari, and vegetables.', 20, 6],
  ['nasi_ayam_bakar', 'Nasi Ayam Bakar', 20000, 'nasi', 'assets/ayam_bakar.png', null, 'populer', 'Grilled chicken with rice, cucumber, and sambal.', 18, 8],
  ['brownies', 'Brownies Lumer', 7000, 'sweets', 'assets/manisan.png', null, 'terdekat', 'Double chocolate brownies with melted center.', 30, 3],
  ['nasi_kebuli', 'Nasi Kebuli', 25000, 'nasi', 'assets/nasi_kebuli.png', null, 'populer', 'Spiced rice with tender meat and raisins.', 10, 8],
  ['dimsum', 'Dimsum Suka', 10500, 'snack', 'assets/dimsum.png', 'Rekomendasi', 'terdekat', 'Steamed dimsum with chili oil.', 35, 4],
  ['mie_goreng_cumi', 'Mie Goreng Cumi', 21000, 'mie', 'assets/miecumi.jpg', null, 'terbaru', 'Stir-fried noodles with squid and sprouts.', 18, 6],
  ['kentang_goreng', 'Kentang Crispy', 10000, 'snack', 'assets/cemilan.png', null, 'terdekat', 'Crispy fries with savory seasoning.', 40, 3],
  ['iced_lemon_tea', 'Iced Lemon Tea', 8000, 'minuman', 'assets/minuman.png', null, 'populer', 'Iced tea with fresh lemon.', 60, 2],
  ['matcha_latte', 'Matcha Latte Creamy', 15000, 'minuman', 'assets/Matchalatte.jpg', 'Baru', 'terbaru', 'Creamy matcha latte.', 25, 2],
];

async function seed() {
  for (const food of foods) {
    await db.query(
      `INSERT INTO foods (food_id, name, price, category, img, badge, tag, description, stock, prep_minutes, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
       ON CONFLICT (food_id) DO UPDATE SET
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         category = EXCLUDED.category,
         img = EXCLUDED.img,
         badge = EXCLUDED.badge,
         tag = EXCLUDED.tag,
         description = EXCLUDED.description,
         stock = GREATEST(foods.stock, EXCLUDED.stock),
         prep_minutes = EXCLUDED.prep_minutes,
         is_available = true`,
      food
    );
  }

  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await db.query(
      `INSERT INTO staff_users (username, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = CURRENT_TIMESTAMP`,
      [process.env.ADMIN_USERNAME, hash]
    );
  } else {
    console.log('ADMIN_USERNAME and ADMIN_PASSWORD not set; staff seed skipped.');
  }
}

if (require.main === module) {
  seed()
    .then(() => db.end())
    .catch((error) => {
      console.error(error.message);
      db.end().finally(() => process.exit(1));
    });
}

module.exports = seed;
