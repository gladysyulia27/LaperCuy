DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_session_status') THEN
    CREATE TYPE queue_session_status AS ENUM ('ISSUED', 'CLAIMED', 'ORDERED', 'EXPIRED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  fullname VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  gender VARCHAR(20),
  password VARCHAR(255),
  avatar_url TEXT,
  saldo INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  food_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  category VARCHAR(40) NOT NULL,
  sold_count INT NOT NULL DEFAULT 0,
  sold_label VARCHAR(30),
  img VARCHAR(255) NOT NULL DEFAULT 'assets/hero_food.png',
  badge VARCHAR(30),
  tag VARCHAR(40) DEFAULT 'populer',
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'kitchen' CHECK (role IN ('admin', 'kitchen')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_sessions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(7) NOT NULL UNIQUE,
  device_id VARCHAR(80) NOT NULL,
  request_id VARCHAR(120) UNIQUE,
  student_token_jti VARCHAR(80) UNIQUE,
  status queue_session_status NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  claimed_at TIMESTAMP,
  ordered_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_sessions_code ON queue_sessions (code);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_expires_at ON queue_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_status ON queue_sessions (status);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  orders_open BOOLEAN NOT NULL DEFAULT TRUE,
  maximum_active_orders INT NOT NULL DEFAULT 30 CHECK (maximum_active_orders > 0),
  kitchen_parallelism INT NOT NULL DEFAULT 2 CHECK (kitchen_parallelism > 0),
  default_session_expiry_minutes INT NOT NULL DEFAULT 5 CHECK (default_session_expiry_minutes > 0),
  claimed_session_expiry_minutes INT NOT NULL DEFAULT 30 CHECK (claimed_session_expiry_minutes > 0),
  device_poll_seconds INT NOT NULL DEFAULT 3 CHECK (device_poll_seconds > 0),
  public_announcement TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  food_id INT NOT NULL REFERENCES foods(id),
  quantity INT NOT NULL DEFAULT 1,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(10) NOT NULL UNIQUE,
  user_id INT,
  subtotal INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  grand_total INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'pay_at_pickup',
  preorder_time VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_id INT NOT NULL REFERENCES foods(id),
  food_name VARCHAR(100) NOT NULL,
  food_price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  note TEXT
);

CREATE TABLE IF NOT EXISTS device_heartbeats (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(80) NOT NULL UNIQUE,
  firmware_version VARCHAR(40),
  wifi_rssi INT,
  ip_reported VARCHAR(80),
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE foods ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 20;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS prep_minutes INT NOT NULL DEFAULT 5;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE foods ADD CONSTRAINT foods_stock_nonnegative CHECK (stock >= 0) NOT VALID;
ALTER TABLE foods ADD CONSTRAINT foods_prep_minutes_positive CHECK (prep_minutes > 0) NOT VALID;
ALTER TABLE foods VALIDATE CONSTRAINT foods_stock_nonnegative;
ALTER TABLE foods VALIDATE CONSTRAINT foods_prep_minutes_positive;

ALTER TABLE carts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS session_id INT UNIQUE REFERENCES queue_sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts (session_id);

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id INT UNIQUE REFERENCES queue_sessions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_weight INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_wait_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ALTER COLUMN discount SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'pay_at_pickup';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'status' AND udt_name = 'order_status_enum'
  ) THEN
    ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(20) USING
      CASE status::text
        WHEN 'pending' THEN 'QUEUED'
        WHEN 'preparing' THEN 'PREPARING'
        WHEN 'ready' THEN 'READY'
        WHEN 'completed' THEN 'PICKED_UP'
        WHEN 'cancelled' THEN 'CANCELLED'
        ELSE UPPER(status::text)
      END;
  END IF;
END $$;

ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(20) USING UPPER(status::text);
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'QUEUED';
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('QUEUED','ACCEPTED','PREPARING','READY','PICKED_UP','REJECTED','CANCELLED')) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_check;
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders (session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prep_minutes_snapshot INT NOT NULL DEFAULT 5;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_users_updated_at') THEN
    CREATE TRIGGER update_staff_users_updated_at BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_queue_sessions_updated_at') THEN
    CREATE TRIGGER update_queue_sessions_updated_at BEFORE UPDATE ON queue_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_settings_updated_at') THEN
    CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_foods_updated_at') THEN
    CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON foods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_device_heartbeats_updated_at') THEN
    CREATE TRIGGER update_device_heartbeats_updated_at BEFORE UPDATE ON device_heartbeats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
