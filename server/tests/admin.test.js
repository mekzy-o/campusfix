const {
  request, app, db, login, as,
} = require('./helpers');

let admin; let student; let officer;
beforeAll(async () => {
  [admin, student, officer] = await Promise.all(['admin', 'student', 'officer'].map((who) => login(who)));
});
afterAll(() => db.destroy());

describe('Role-based access control', () => {
  const adminOnly = ['/api/users', '/api/roles', '/api/audit-logs', '/api/reports/summary', '/api/users/officers'];

  it.each(adminOnly)('%s is forbidden to students (403)', async (url) => {
    expect((await as(student.token).get(url)).status).toBe(403);
  });

  it.each(adminOnly)('%s is forbidden to officers (403)', async (url) => {
    expect((await as(officer.token).get(url)).status).toBe(403);
  });

  it.each(adminOnly)('%s is available to administrators', async (url) => {
    expect((await as(admin.token).get(url)).status).toBe(200);
  });
});

describe('User management', () => {
  let created;

  it('creates a maintenance officer with skills (many-to-many) and a profile (one-to-one)', async () => {
    const cats = await db('categories').whereIn('name', ['Plumbing & Water', 'Hostel Maintenance']).pluck('id');
    const res = await as(admin.token).post('/api/users').send({
      fullName: 'Musa Danjuma',
      email: 'musa.danjuma@campusfix.app',
      password: 'Officer123',
      role: 'OFFICER',
      specialisation: 'Plumber',
      categoryIds: cats,
    });
    expect(res.status).toBe(201);
    created = res.body.data;
    expect(created.role).toBe('OFFICER');
    expect(created.categories.map((c) => c.id).sort()).toEqual(cats.sort());
    const profile = await db('officer_profiles').where({ user_id: created.id }).first();
    expect(profile.specialisation).toBe('Plumber');
  });

  it('lists and searches users with pagination', async () => {
    const res = await as(admin.token).get('/api/users?q=danjuma');
    expect(res.body.data).toHaveLength(1);
    const byRole = await as(admin.token).get('/api/users?role=OFFICER&limit=2');
    expect(byRole.body.data).toHaveLength(2);
    expect(byRole.body.pagination.total).toBeGreaterThanOrEqual(6);
  });

  it('ranks officers skilled in a category first for assignment', async () => {
    const cat = await db('categories').where({ name: 'Plumbing & Water' }).first('id');
    const res = await as(admin.token).get(`/api/users/officers?categoryId=${cat.id}`);
    expect(res.body.data[0].matches_category).toBe(true);
  });

  it('deactivating a user blocks sign-in', async () => {
    const res = await as(admin.token).delete(`/api/users/${created.id}`);
    expect(res.status).toBe(200);
    const signIn = await request(app).post('/api/auth/login').send({ email: 'musa.danjuma@campusfix.app', password: 'Officer123' });
    expect(signIn.status).toBe(403);
  });

  it('a deactivated user loses API access immediately even with a valid token', async () => {
    const fresh = await as(admin.token).post('/api/users').send({
      fullName: 'Temp Staff', email: 'temp.staff@campusfix.app', password: 'TempStaff1', role: 'STAFF',
    });
    const { token } = await login('temp.staff@campusfix.app', 'TempStaff1');
    await as(admin.token).patch(`/api/users/${fresh.body.data.id}`).send({ isActive: false });
    expect((await as(token).get('/api/auth/me')).status).toBe(401);
  });

  it('an administrator cannot deactivate themselves', async () => {
    const res = await as(admin.token).delete(`/api/users/${admin.user.id}`);
    expect(res.status).toBe(409);
  });

  it('cannot change an officer with open jobs to another role (409)', async () => {
    const { createRequest } = require('./helpers'); // eslint-disable-line global-require
    const r = await createRequest(student.token, { title: 'Open job blocks role change' });
    await as(admin.token).post(`/api/requests/${r.id}/assign`).send({ officerId: officer.user.id });
    const res = await as(admin.token).patch(`/api/users/${officer.user.id}`).send({ role: 'STAFF' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/open job/);
  });
});

describe('Categories', () => {
  it('creates, updates and deletes an unused category', async () => {
    const created = await as(admin.token).post('/api/categories').send({ name: 'Pest Control', defaultPriority: 'HIGH' });
    expect(created.status).toBe(201);
    const { id } = created.body.data;
    const updated = await as(admin.token).patch(`/api/categories/${id}`).send({ description: 'Rodents, insects, snakes' });
    expect(updated.body.data.description).toBe('Rodents, insects, snakes');
    const del = await as(admin.token).delete(`/api/categories/${id}`);
    expect(del.body.message).toMatch(/deleted/);
  });

  it('deactivates instead of deleting a category in use (referential integrity)', async () => {
    const used = await db('categories').where({ name: 'Electricity & Power' }).first('id');
    const res = await as(admin.token).delete(`/api/categories/${used.id}`);
    expect(res.body.message).toMatch(/deactivated/);
    await as(admin.token).patch(`/api/categories/${used.id}`).send({ isActive: true });
  });

  it('rejects a duplicate name with 409', async () => {
    const res = await as(admin.token).post('/api/categories').send({ name: 'Plumbing & Water' });
    expect(res.status).toBe(409);
  });
});

describe('Reports and export', () => {
  it('returns the summary report', async () => {
    const res = await as(admin.token).get('/api/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.totals.total).toBeGreaterThan(0);
    expect(res.body.data.monthly).toHaveLength(6);
    expect(res.body.data.officers.length).toBeGreaterThan(0);
  });

  it('exports CSV with a header row', async () => {
    const res = await as(admin.token).get('/api/reports/export?format=csv&status=CLOSED');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="campusfix-requests-.*\.csv"/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toContain('"Reference"');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('exports a PDF', async () => {
    const res = await as(admin.token).get('/api/reports/export?format=pdf').buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('officers can export only their own jobs', async () => {
    const res = await as(officer.token).get('/api/reports/export?format=csv');
    expect(res.status).toBe(200);
    const rows = res.text.trim().split('\r\n').slice(1);
    rows.forEach((row) => expect(row).toContain('"Ibrahim Musa"'));
  });

  it('role-specific dashboard data', async () => {
    const a = await as(admin.token).get('/api/dashboard');
    expect(a.body.data).toHaveProperty('usersByRole');
    const s = await as(student.token).get('/api/dashboard');
    expect(s.body.data).toHaveProperty('awaitingConfirmation');
    expect(s.body.data).not.toHaveProperty('usersByRole');
  });
});

describe('Audit trail and notifications', () => {
  it('records exports and logins in the audit log', async () => {
    const res = await as(admin.token).get('/api/audit-logs?action=DATA_EXPORTED');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('ip_address');
    expect(res.body.actions).toEqual(expect.arrayContaining(['USER_LOGIN']));
  });

  it('lists notifications and marks them read', async () => {
    const list = await as(student.token).get('/api/notifications');
    expect(list.status).toBe(200);
    const unread = list.body.data.find((n) => !n.is_read);
    if (unread) {
      const res = await as(student.token).patch(`/api/notifications/${unread.id}/read`);
      expect(res.status).toBe(200);
    }
    await as(student.token).patch('/api/notifications/read-all');
    const count = await as(student.token).get('/api/notifications/unread-count');
    expect(count.body.unread).toBe(0);
  });

  it("cannot mark someone else's notification", async () => {
    const other = await db('notifications').whereNot({ user_id: student.user.id }).first('id');
    const res = await as(student.token).patch(`/api/notifications/${other.id}/read`);
    expect(res.status).toBe(404);
  });
});

describe('System', () => {
  it('health check confirms the database connection', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/requests', '/auth/login']));
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await as(admin.token).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Route not found/);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});
