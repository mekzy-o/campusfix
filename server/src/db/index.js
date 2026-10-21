/** Shared Knex instance (connection pool) for the whole application. */
const knex = require('knex');
const knexConfig = require('../../knexfile');

const db = knex(knexConfig);

module.exports = db;
