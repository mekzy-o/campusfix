/** Shared helpers for API tests. */
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const PASSWORD = 'CampusFix@2026';
const ACCOUNTS = {
  admin: 'admin@campusfix.app',
  officer: 'ibrahim.musa@campusfix.app',
  officer2: 'chinedu.eze@campusfix.app',
  student: 'student@campusfix.app',
  student2: 'aisha.bello@campusfix.app',
  staff: 'staff@campusfix.app',
};

/** Signs in and returns { token, user, cookie }. */
async function login(who, password = PASSWORD) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: ACCOUNTS[who] || who, password });
  if (res.status !== 200) throw new Error(`Login failed for ${who}: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, user: res.body.user, cookie: res.headers['set-cookie'] };
}

/** supertest wrapper that adds the bearer token. */
function as(token) {
  const withAuth = (method) => (url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  return {
    get: withAuth('get'), post: withAuth('post'), patch: withAuth('patch'), delete: withAuth('delete'),
  };
}

/** Creates a fresh PENDING request owned by the given requester. */
async function createRequest(token, overrides = {}) {
  const category = await db('categories').where({ name: 'Plumbing & Water' }).first('id');
  const res = await as(token).post('/api/requests').send({
    title: 'Test leaking tap in bathroom',
    description: 'The tap has been dripping continuously since yesterday.',
    categoryId: category.id,
    location: 'Hostel A (Male)',
    room: 'Room 101',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`Create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Tiny valid PNG (1×1 pixel) used for upload tests. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

module.exports = {
  app, db, request, login, as, createRequest, PNG, PASSWORD, ACCOUNTS,
};
