const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(connectionString ? {
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
} : {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'lapercuy_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
