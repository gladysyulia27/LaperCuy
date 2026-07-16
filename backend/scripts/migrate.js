const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function ensureHistory() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function migrate() {
  await ensureHistory();
  const dir = path.join(__dirname, '..', '..', 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = await db.query('SELECT id FROM migration_history WHERE filename = $1', [file]);
    if (existing.rowCount > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migration_history (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  migrate()
    .then(() => db.end())
    .catch((error) => {
      console.error(error.message);
      db.end().finally(() => process.exit(1));
    });
}

module.exports = migrate;
