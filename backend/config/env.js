require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const requiredProduction = [
  'STUDENT_JWT_SECRET',
  'STAFF_JWT_SECRET',
  'COOKIE_SECRET',
  'DEVICE_API_KEY',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
];

function validateEnv() {
  if (!isProduction) return;
  const missing = requiredProduction.filter((key) => !process.env[key] || process.env[key].includes('change-me'));
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  isProduction,
  validateEnv,
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  studentJwtSecret: process.env.STUDENT_JWT_SECRET || 'dev-student-secret-change-me',
  staffJwtSecret: process.env.STAFF_JWT_SECRET || 'dev-staff-secret-change-me',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-me',
  deviceApiKey: process.env.DEVICE_API_KEY || 'dev-device-key-change-me',
  sessionCodeExpiryMinutes: parseInt(process.env.SESSION_CODE_EXPIRY_MINUTES || '5', 10),
  claimedSessionExpiryMinutes: parseInt(process.env.CLAIMED_SESSION_EXPIRY_MINUTES || '30', 10),
  maxActiveOrders: parseInt(process.env.MAX_ACTIVE_ORDERS || '30', 10),
  kitchenParallelism: parseInt(process.env.KITCHEN_PARALLELISM || '2', 10),
};
