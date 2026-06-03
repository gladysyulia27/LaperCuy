/**
 * LaperCuy — Script Setup Database Otomatis (PostgreSQL Version)
 * Jalankan: node setup-db.js
 * 
 * Script ini akan:
 * 1. Mendeteksi dan membuat database lapercuy_db jika belum ada
 * 2. Menghubungkan client ke lapercuy_db
 * 3. Membuat semua tipe ENUM, tabel, trigger, dan seed data dari schema_postgresql.sql
 */

require('dotenv').config();
const { Client } = require('pg');
const fs         = require('fs');
const path       = require('path');

const run = async () => {
  console.log('\n  🍛  LaperCuy — PostgreSQL Database Setup\n  ─────────────────────────────');

  const pgHost = process.env.DB_HOST || 'localhost';
  const pgPort = parseInt(process.env.DB_PORT) || 5432;
  const pgUser = process.env.DB_USER || 'postgres';
  const pgPass = process.env.DB_PASS || 'postgres';
  const pgName = process.env.DB_NAME || 'lapercuy_db';

  // 1. Koneksi ke database sistem 'postgres' untuk membuat DB target jika belum ada
  const sysClient = new Client({
    host:     pgHost,
    port:     pgPort,
    user:     pgUser,
    password: pgPass,
    database: 'postgres',
  });

  try {
    await sysClient.connect();
    
    // Cek apakah database target sudah ada
    const dbCheck = await sysClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [pgName]
    );

    if (dbCheck.rowCount === 0) {
      console.log(`  ➕  Membuat database "${pgName}"...`);
      // CREATE DATABASE tidak dapat berjalan di dalam transaksi/parameterized query
      await sysClient.query(`CREATE DATABASE "${pgName}"`);
      console.log(`  ✅  Database "${pgName}" berhasil dibuat!`);
    } else {
      console.log(`  ℹ️  Database "${pgName}" sudah tersedia.`);
    }
  } catch (err) {
    console.error('❌ Gagal memeriksa/membuat database:', err.message);
    sysClient.end();
    process.exit(1);
  } finally {
    await sysClient.end();
  }

  // 2. Koneksi ke database target untuk menjalankan skema
  const dbClient = new Client({
    host:     pgHost,
    port:     pgPort,
    user:     pgUser,
    password: pgPass,
    database: pgName,
  });

  try {
    await dbClient.connect();
    console.log(`  🔌  Berhasil terhubung ke database "${pgName}"`);

    // Baca file SQL PostgreSQL
    const sqlFile = path.join(__dirname, '..', 'database', 'schema_postgresql.sql');
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`File SQL ${sqlFile} tidak ditemukan!`);
    }
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('  📄  Membaca & menjalankan script SQL PostgreSQL...');
    await dbClient.query(sql);

    console.log('  ✅  Semua tabel berhasil dibuat!');
    console.log('  ✅  Semua trigger updated_at berhasil didaftarkan!');
    console.log('  ✅  Data seed 10 menu berhasil diisi!');
    console.log('\n  ─────────────────────────────');
    console.log('  🚀  Siap! Jalankan: npm start atau npm run dev\n');

  } catch (err) {
    console.error('\n  ❌  Error:', err.message);
    console.log('\n  💡  Tips: Pastikan PostgreSQL sudah berjalan!');
    console.log('  💡  Cek juga DB_USER dan DB_PASS di file .env\n');
  } finally {
    await dbClient.end();
    process.exit(0);
  }
};

run();
