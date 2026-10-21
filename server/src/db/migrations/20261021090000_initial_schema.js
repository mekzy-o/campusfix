/**
 * Initial CampusFix schema.
 *
 * Relationship types demonstrated:
 *  - One-to-one:   users      1 ── 1  officer_profiles
 *  - One-to-many:  roles      1 ── *  users
 *                  users      1 ── *  service_requests (requester)
 *                  categories 1 ── *  service_requests
 *                  service_requests 1 ── * assignments / status_logs / attachments
 *  - Many-to-many: officers   * ── *  categories (via officer_categories)
 *                  officers   * ── *  service_requests (via assignments, with history)
 */

const REQUEST_STATUSES = [
  'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
  'COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED',
];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('roles', (t) => {
    t.increments('id').primary();
    t.string('name', 30).notNullable().unique(); // STUDENT, STAFF, OFFICER, ADMIN
    t.string('label', 60).notNullable();
    t.string('description', 255);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('full_name', 120).notNullable();
    t.string('email', 160).notNullable().unique();
    t.string('password_hash', 100).notNullable();
    t.string('phone', 20);
    t.string('department', 120);
    t.string('id_number', 40); // matric number or staff number
    t.integer('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
    t.index(['role_id']);
  });

  // One-to-one extension of users for maintenance officers.
  await knex.schema.createTable('officer_profiles', (t) => {
    t.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    t.string('staff_code', 30).unique();
    t.string('specialisation', 120);
    t.enu('availability', ['AVAILABLE', 'BUSY', 'OFF_DUTY']).notNullable().defaultTo('AVAILABLE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.string('name', 80).notNullable().unique();
    t.string('description', 255);
    t.string('icon', 40);
    t.enu('default_priority', PRIORITIES).notNullable().defaultTo('MEDIUM');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // Many-to-many: which categories each officer is skilled in.
  await knex.schema.createTable('officer_categories', (t) => {
    t.uuid('officer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('category_id').notNullable().references('id').inTable('categories').onDelete('CASCADE');
    t.primary(['officer_id', 'category_id']);
  });

  await knex.raw('CREATE SEQUENCE IF NOT EXISTS request_ref_seq START 1');

  await knex.schema.createTable('service_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('reference', 20).notNullable().unique(); // e.g. SR-2026-00042
    t.string('title', 150).notNullable();
    t.text('description').notNullable();
    t.integer('category_id').notNullable().references('id').inTable('categories').onDelete('RESTRICT');
    t.uuid('requester_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('location', 120).notNullable(); // building / hostel / block
    t.string('room', 60);
    t.enu('priority', PRIORITIES).notNullable().defaultTo('MEDIUM');
    t.enu('status', REQUEST_STATUSES).notNullable().defaultTo('PENDING');
    t.timestamp('completed_at');
    t.timestamp('closed_at');
    t.smallint('rating'); // 1–5 satisfaction rating from requester
    t.text('feedback');
    t.timestamps(true, true);
    t.index(['status']);
    t.index(['category_id']);
    t.index(['requester_id']);
    t.index(['created_at']);
  });
  await knex.raw(
    'ALTER TABLE service_requests ADD CONSTRAINT rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))',
  );

  // Assignment history: one active row per request, older rows kept for accountability.
  await knex.schema.createTable('assignments', (t) => {
    t.increments('id').primary();
    t.uuid('request_id').notNullable().references('id').inTable('service_requests').onDelete('CASCADE');
    t.uuid('officer_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.uuid('assigned_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('note');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('unassigned_at');
    t.index(['officer_id', 'is_active']);
    t.index(['request_id']);
  });
  await knex.raw(
    'CREATE UNIQUE INDEX one_active_assignment_per_request ON assignments (request_id) WHERE is_active',
  );

  await knex.schema.createTable('status_logs', (t) => {
    t.increments('id').primary();
    t.uuid('request_id').notNullable().references('id').inTable('service_requests').onDelete('CASCADE');
    t.enu('from_status', REQUEST_STATUSES);
    t.enu('to_status', REQUEST_STATUSES).notNullable();
    t.uuid('changed_by').references('id').inTable('users').onDelete('SET NULL');
    t.text('comment');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['request_id']);
  });

  // Evidence photos are stored in the database so they survive redeploys on
  // hosts with ephemeral disks (e.g. Render free tier).
  await knex.schema.createTable('attachments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('request_id').notNullable().references('id').inTable('service_requests').onDelete('CASCADE');
    t.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    t.enu('kind', ['EVIDENCE', 'COMPLETION']).notNullable().defaultTo('EVIDENCE');
    t.string('filename', 200).notNullable();
    t.string('mime_type', 60).notNullable();
    t.integer('size_bytes').notNullable();
    t.binary('data').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['request_id']);
  });

  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 40).notNullable();
    t.string('title', 150).notNullable();
    t.string('message', 500).notNullable();
    t.uuid('request_id').references('id').inTable('service_requests').onDelete('CASCADE');
    t.boolean('is_read').notNullable().defaultTo(false);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'is_read']);
  });

  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('actor_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 60).notNullable(); // e.g. REQUEST_CREATED, USER_LOGIN
    t.string('entity_type', 40);
    t.string('entity_id', 60);
    t.jsonb('details');
    t.string('ip_address', 64);
    t.string('user_agent', 255);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['action']);
    t.index(['actor_id']);
    t.index(['created_at']);
  });

  // Server-side session store for refresh tokens (hashed, rotatable, revocable).
  await knex.schema.createTable('sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 128).notNullable().unique();
    t.string('user_agent', 255);
    t.string('ip_address', 64);
    t.timestamp('expires_at').notNullable();
    t.timestamp('revoked_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  const tables = [
    'sessions', 'audit_logs', 'notifications', 'attachments', 'status_logs',
    'assignments', 'service_requests', 'officer_categories', 'categories',
    'officer_profiles', 'users', 'roles',
  ];
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.dropTableIfExists(table);
  }
  await knex.raw('DROP SEQUENCE IF EXISTS request_ref_seq');
};
