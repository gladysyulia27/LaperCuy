// config/db.js — PostgreSQL Connection Pool
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'postgres',
  database: process.env.DB_NAME     || 'lapercuy_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅  PostgreSQL connected — database:', process.env.DB_NAME);
    client.release();
  })
  .catch(err => {
    console.error('❌  PostgreSQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
