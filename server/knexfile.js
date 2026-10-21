/**
 * Knex configuration used by both the application and the knex CLI
 * (migrations and seeds).
 */
const path = require('path');
const config = require('./src/config');

module.exports = {
  client: 'pg',
  connection: {
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: path.join(__dirname, 'src/db/migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'src/db/seeds'),
  },
};
