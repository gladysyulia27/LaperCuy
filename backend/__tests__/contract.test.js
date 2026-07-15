const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

test('migration defines queue sessions, staff users, stock, settings, and legal statuses', () => {
  const sql = fs.readFileSync(path.join(root, 'database/migrations/001_delqueue_core.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS queue_sessions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS staff_users/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS system_settings/);
  assert.match(sql, /ALTER TABLE foods ADD COLUMN IF NOT EXISTS stock/);
  assert.match(sql, /'QUEUED','ACCEPTED','PREPARING','READY','PICKED_UP','REJECTED','CANCELLED'/);
});

test('backend uses non-ambiguous ABC-123 code character set', () => {
  const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
  assert.match(app, /CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'/);
  assert.match(app, /CODE_RE = \/\^\[A-HJ-NP-Z2-9\]\{3\}-\[A-HJ-NP-Z2-9\]\{3\}\$\//);
  const chars = app.match(/CODE_CHARS = '([^']+)'/)[1];
  assert.equal(chars.includes('I'), false);
  assert.equal(chars.includes('O'), false);
  assert.equal(chars.includes('0'), false);
  assert.equal(chars.includes('1'), false);
});

test('examples keep secrets as placeholders only', () => {
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const secrets = fs.readFileSync(path.join(root, 'firmware/esp32-delqueue/include/secrets.example.h'), 'utf8');
  const forbidden = ['23', '1006'].join('');
  assert.match(env, /replace-with/);
  assert.match(secrets, /replace-with-device-api-key/);
  assert.equal(env.includes(forbidden), false);
  assert.equal(secrets.includes(forbidden), false);
});

test('compose binds app to localhost and does not expose postgres host port', () => {
  const compose = fs.readFileSync(path.join(root, 'deploy/docker-compose.yml'), 'utf8');
  assert.match(compose, /127\.0\.0\.1:8092:3000/);
  assert.doesNotMatch(compose, /5432:5432/);
});
