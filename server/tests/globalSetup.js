/**
 * Runs once before the whole test suite: rebuilds the TEST database from
 * scratch and loads the demo seed, so every run starts from the same state.
 */
module.exports = async () => {
  process.env.NODE_ENV = 'test';
  // eslint-disable-next-line global-require
  const knex = require('knex')(require('../knexfile'));
  try {
    await knex.migrate.rollback(undefined, true);
    await knex.migrate.latest();
    await knex.seed.run();
  } finally {
    await knex.destroy();
  }
};
