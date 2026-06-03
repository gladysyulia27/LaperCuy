-- ============================================================
-- LaperCuy Database Schema (PostgreSQL Version)
-- Aplikasi Pemesanan Makanan
-- ============================================================

-- 1. DROP EXISTING TABLES & TYPES (Untuk Memudahkan Reset Database)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS gender_enum CASCADE;
DROP TYPE IF EXISTS food_category_enum CASCADE;
DROP TYPE IF EXISTS food_tag_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;

-- 2. CREATE ENUM TYPES
CREATE TYPE gender_enum AS ENUM ('Pria', 'Wanita');
CREATE TYPE food_category_enum AS ENUM ('nasi', 'mie', 'sweets', 'snack', 'minuman');
CREATE TYPE food_tag_enum AS ENUM ('populer', 'terdekat', 'terbaru');
CREATE TYPE order_status_enum AS ENUM ('pending', 'preparing', 'ready', 'completed', 'cancelled');

-- 3. CREATE TABLES

-- TABLE: users
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  fullname    VARCHAR(100)  NOT NULL,
  username    VARCHAR(50)   NOT NULL UNIQUE,
  email       VARCHAR(100)  NOT NULL UNIQUE,
  phone       VARCHAR(20)   DEFAULT NULL,
  gender      gender_enum   DEFAULT NULL,
  password    VARCHAR(255)  NOT NULL,
  avatar_url  TEXT          DEFAULT NULL,
  saldo       INT           NOT NULL DEFAULT 5000,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: foods
CREATE TABLE foods (
  id          SERIAL PRIMARY KEY,
  food_id     VARCHAR(50)   NOT NULL UNIQUE,
  name        VARCHAR(100)  NOT NULL,
  price       INT           NOT NULL,
  category    food_category_enum NOT NULL,
  sold_count  INT           NOT NULL DEFAULT 0,
  sold_label  VARCHAR(30)   DEFAULT NULL,
  img         VARCHAR(255)  NOT NULL,
  badge       VARCHAR(30)   DEFAULT NULL,
  tag         food_tag_enum DEFAULT 'populer',
  description TEXT          DEFAULT NULL,
  is_available BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: carts
CREATE TABLE carts (
  id          SERIAL PRIMARY KEY,
  user_id     INT           NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- TABLE: cart_items
CREATE TABLE cart_items (
  id          SERIAL PRIMARY KEY,
  cart_id     INT           NOT NULL,
  food_id     INT           NOT NULL,
  quantity    INT           NOT NULL DEFAULT 1,
  note        TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_item_food FOREIGN KEY (food_id) REFERENCES foods(id)
);

-- TABLE: orders
CREATE TABLE orders (
  id              SERIAL PRIMARY KEY,
  order_code      VARCHAR(10)   NOT NULL UNIQUE,
  user_id         INT           NOT NULL,
  subtotal        INT           NOT NULL DEFAULT 0,
  discount        INT           NOT NULL DEFAULT 0,
  grand_total     INT           NOT NULL DEFAULT 0,
  payment_method  VARCHAR(30)   NOT NULL DEFAULT 'cash',
  preorder_time   VARCHAR(20)   DEFAULT NULL,
  status          order_status_enum NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TABLE: order_items
CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT           NOT NULL,
  food_id     INT           NOT NULL,
  food_name   VARCHAR(100)  NOT NULL,
  food_price  INT           NOT NULL,
  quantity    INT           NOT NULL DEFAULT 1,
  note        TEXT          DEFAULT NULL,
  CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_item_food  FOREIGN KEY (food_id)  REFERENCES foods(id)
);

-- 4. COLUMN COMMENTS (Metadata)
COMMENT ON COLUMN foods.food_id IS 'slug identifier (nasi_jeruk)';
COMMENT ON COLUMN foods.sold_label IS 'Display label: 1k+ kali';
COMMENT ON COLUMN foods.badge IS 'Bestseller / -10% / Baru / Rekomendasi';
COMMENT ON COLUMN orders.order_code IS 'Tiket antrean: A036';
COMMENT ON COLUMN order_items.food_name IS 'Snapshot nama saat order';
COMMENT ON COLUMN order_items.food_price IS 'Snapshot harga saat order';

-- 5. AUTO UPDATE updated_at TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. SEED DATA: foods (10 menu dari frontend)
INSERT INTO foods (food_id, name, price, category, sold_count, sold_label, img, badge, tag, description, is_available) VALUES
('nasi_jeruk',     'Nasi Jeruk Special',   15000, 'nasi',    1000, '1k+ kali',   'assets/nasi_jeruk.png',    'Bestseller',   'populer',  'Aromatic lime rice served with crispy fried chicken and sambal matah.',          TRUE),
('mie_rebus',      'Mie Rebus Seafood',    22000, 'mie',      800, '800+ kali',  'assets/mie_seafood.png',   '-10%',         'terbaru',  'Authentic rich broth noodle with fresh shrimp, calamari, and vegetables.',       TRUE),
('nasi_ayam_bakar','Nasi Ayam Bakar',      20000, 'nasi',    2000, '2k+ kali',   'assets/ayam_bakar.png',    NULL,           'populer',  'Grilled chicken marinated in sweet soy sauce, served with rice and fresh cucumber.',TRUE),
('brownies',       'Brownies Lumer',        7000, 'sweets',   500, '500+ kali',  'assets/manisan.png',       NULL,           'terdekat', 'Double chocolate brownies with melted hot chocolate lava in the center.',        TRUE),
('nasi_kebuli',    'Nasi Kebuli',          25000, 'nasi',     300, '300+ kali',  'assets/nasi_kebuli.png',   NULL,           'populer',  'Richly spiced rice cooked in mutton broth, topped with tender mutton and raisins.',FALSE),
('dimsum',         'Dimsum Suka',          10500, 'snack',   1200, '1.2k+ kali', 'assets/dimsum.png',        'Rekomendasi',  'terdekat', 'Steamed chicken and shrimp dimsum served with special hot chili oil dip.',       TRUE),
('mie_goreng_cumi','Mie Goreng Cumi',      21000, 'mie',      400, '400+ kali',  'assets/miecumi.jpg',       NULL,           'terbaru',  'Savory stir-fried noodles with fresh squid, bean sprouts, and aromatic spices.',  TRUE),
('kentang_goreng', 'Kentang Crispy',       10000, 'snack',    900, '900+ kali',  'assets/cemilan.png',       NULL,           'terdekat', 'Golden crispy french fries seasoned with special salted egg savory powder.',      TRUE),
('iced_lemon_tea', 'Iced Lemon Tea',        8000, 'minuman', 1500, '1.5k+ kali', 'assets/minuman.png',       NULL,           'populer',  'Refreshing iced black tea brewed with fresh lemon juice and fresh mint.',        TRUE),
('matcha_latte',   'Matcha Latte Creamy',  15000, 'minuman',  250, '250+ kali',  'assets/Matchalatte.jpg',   'Baru',         'terbaru',  'Creamy premium Uji matcha whisked with fresh whole milk and sweetener.',         TRUE);
