-- ============================================================
-- LaperCuy Database Schema
-- Aplikasi Pemesanan Makanan
-- ============================================================

CREATE DATABASE IF NOT EXISTS lapercuy_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lapercuy_db;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  fullname    VARCHAR(100)  NOT NULL,
  username    VARCHAR(50)   NOT NULL UNIQUE,
  email       VARCHAR(100)  NOT NULL UNIQUE,
  phone       VARCHAR(20)   DEFAULT NULL,
  gender      ENUM('Pria', 'Wanita') DEFAULT NULL,
  password    VARCHAR(255)  NOT NULL,
  avatar_url  TEXT          DEFAULT NULL,
  saldo       INT           NOT NULL DEFAULT 5000,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: foods
-- ============================================================
CREATE TABLE IF NOT EXISTS foods (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  food_id     VARCHAR(50)   NOT NULL UNIQUE COMMENT 'slug identifier (nasi_jeruk)',
  name        VARCHAR(100)  NOT NULL,
  price       INT           NOT NULL,
  category    ENUM('nasi','mie','manisan','cemilan','minuman') NOT NULL,
  sold_count  INT           NOT NULL DEFAULT 0,
  sold_label  VARCHAR(30)   DEFAULT NULL COMMENT 'Display label: 1k+ kali',
  img         VARCHAR(255)  NOT NULL,
  badge       VARCHAR(30)   DEFAULT NULL COMMENT 'Bestseller / -10% / Baru / Rekomendasi',
  tag         ENUM('populer','terdekat','terbaru') DEFAULT 'populer',
  description TEXT          DEFAULT NULL,
  is_available TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: carts
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: cart_items
-- ============================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cart_id     INT           NOT NULL,
  food_id     INT           NOT NULL,
  quantity    INT           NOT NULL DEFAULT 1,
  note        TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_item_food FOREIGN KEY (food_id) REFERENCES foods(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_code      VARCHAR(10)   NOT NULL UNIQUE COMMENT 'Tiket antrean: A036',
  user_id         INT           NOT NULL,
  subtotal        INT           NOT NULL DEFAULT 0,
  discount        INT           NOT NULL DEFAULT 0,
  grand_total     INT           NOT NULL DEFAULT 0,
  payment_method  VARCHAR(30)   NOT NULL DEFAULT 'cash',
  preorder_time   VARCHAR(20)   DEFAULT NULL,
  status          ENUM('pending','preparing','ready','completed','cancelled')
                                NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT           NOT NULL,
  food_id     INT           NOT NULL,
  food_name   VARCHAR(100)  NOT NULL COMMENT 'Snapshot nama saat order',
  food_price  INT           NOT NULL COMMENT 'Snapshot harga saat order',
  quantity    INT           NOT NULL DEFAULT 1,
  note        TEXT          DEFAULT NULL,
  CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_item_food  FOREIGN KEY (food_id)  REFERENCES foods(id)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA: foods (10 menu dari frontend)
-- ============================================================
INSERT INTO foods (food_id, name, price, category, sold_count, sold_label, img, badge, tag, description, is_available) VALUES
('nasi_jeruk',     'Nasi Jeruk Special',   15000, 'nasi',    1000, '1k+ kali',   'assets/nasi_jeruk.png',    'Bestseller',   'populer',  'Aromatic lime rice served with crispy fried chicken and sambal matah.',          1),
('mie_rebus',      'Mie Rebus Seafood',    22000, 'mie',      800, '800+ kali',  'assets/mie_seafood.png',   '-10%',         'terbaru',  'Authentic rich broth noodle with fresh shrimp, calamari, and vegetables.',       1),
('nasi_ayam_bakar','Nasi Ayam Bakar',      20000, 'nasi',    2000, '2k+ kali',   'assets/ayam_bakar.png',    NULL,           'populer',  'Grilled chicken marinated in sweet soy sauce, served with rice and fresh cucumber.',1),
('brownies',       'Brownies Lumer',        7000, 'manisan',   500, '500+ kali',  'assets/manisan.png',       NULL,           'terdekat', 'Double chocolate brownies with melted hot chocolate lava in the center.',        1),
('nasi_kebuli',    'Nasi Kebuli',          25000, 'nasi',     300, '300+ kali',  'assets/nasi_kebuli.png',   NULL,           'populer',  'Richly spiced rice cooked in mutton broth, topped with tender mutton and raisins.',0),
('dimsum',         'Dimsum Suka',          10500, 'cemilan',   1200, '1.2k+ kali', 'assets/dimsum.png',        'Rekomendasi',  'terdekat', 'Steamed chicken and shrimp dimsum served with special hot chili oil dip.',       1),
('mie_goreng_cumi','Mie Goreng Cumi',      21000, 'mie',      400, '400+ kali',  'assets/miecumi.jpg',       NULL,           'terbaru',  'Savory stir-fried noodles with fresh squid, bean sprouts, and aromatic spices.',  1),
('kentang_goreng', 'Kentang Crispy',       10000, 'cemilan',    900, '900+ kali',  'assets/cemilan.png',       NULL,           'terdekat', 'Golden crispy french fries seasoned with special salted egg savory powder.',      1),
('iced_lemon_tea', 'Iced Lemon Tea',        8000, 'minuman', 1500, '1.5k+ kali', 'assets/minuman.png',       NULL,           'populer',  'Refreshing iced black tea brewed with fresh lemon juice and fresh mint.',        1),
('matcha_latte',   'Matcha Latte Creamy',  15000, 'minuman',  250, '250+ kali',  'assets/Matchalatte.jpg',   'Baru',         'terbaru',  'Creamy premium Uji matcha whisked with fresh whole milk and sweetener.',         1);
