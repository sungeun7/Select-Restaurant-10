const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { getPool } = require('./db');

async function createSessionStore() {
  const pool = await getPool();

  // Table `sessions` is created by backend/sql/schema.sql
  return new MySQLStore({
    pool,
    // Our schema already provides the `sessions` table.
    createDatabaseTable: false,
    clearExpired: true,
    expiration: 1000 * 60 * 60 * 24 * 7 // 7 days
  });
}

module.exports = { createSessionStore };

