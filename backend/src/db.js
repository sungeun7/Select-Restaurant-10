const mysql = require('mysql2/promise');
const { Connector } = require('@google-cloud/cloud-sql-connector');

let pool = null;
let connector = null;

async function getPool() {
  if (pool) return pool;

  const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
  if (!instanceConnectionName) throw new Error('Missing env: INSTANCE_CONNECTION_NAME');

  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASS;
  const dbName = process.env.DB_NAME || 'sr10';
  if (!dbUser) throw new Error('Missing env: DB_USER');
  if (!dbPass) throw new Error('Missing env: DB_PASS');

  const ipType = process.env.SQL_IP_TYPE || 'PRIVATE';
  const poolSize = parseInt(process.env.DB_POOL_SIZE || '5', 10);

  connector = connector || new Connector();
  // connector.getOptions() returns connection options that work with Cloud SQL connector.
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType,
  });

  pool = mysql.createPool({
    ...clientOpts,
    user: dbUser,
    password: dbPass,
    database: dbName,
    waitForConnections: true,
    connectionLimit: poolSize,
    queueLimit: 0,
  });

  return pool;
}

module.exports = { getPool };

