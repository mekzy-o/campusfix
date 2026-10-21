/** HTTP + Socket.IO server entry point. */
const http = require('http');
const app = require('./app');
const config = require('./config');
const db = require('./db');
const { initRealtime } = require('./realtime');

const server = http.createServer(app);
initRealtime(server);

async function start() {
  try {
    await db.raw('select 1');
    if (config.isProd || process.env.RUN_MIGRATIONS === 'true') {
      const [, applied] = await db.migrate.latest();
      if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
    }
    // On a brand-new database, load the demo data so the deployed app can be
    // explored straight away (controlled by SEED_IF_EMPTY=true).
    if (process.env.SEED_IF_EMPTY === 'true') {
      const [{ count }] = await db('users').count('id as count');
      if (Number(count) === 0) {
        await db.seed.run();
        console.log('Database was empty: demo data loaded');
      }
    }
    server.listen(config.port, () => {
      console.log(`CampusFix API listening on port ${config.port} (${config.env})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

function shutdown() {
  server.close(() => db.destroy().then(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
