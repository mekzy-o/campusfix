const {
  db, login, as, createRequest, PNG,
} = require('./helpers');

let admin; let officer; let officer2; let student; let student2; let staff;

beforeAll(async () => {
  [admin, officer, officer2, student, student2, staff] = await Promise.all(
    ['admin', 'officer', 'officer2', 'student', 'student2', 'staff'].map((who) => login(who)),
  );
});
afterAll(() => db.destroy());

describe('Creating requests', () => {
  it('lets a student submit a request with evidence photos', async () => {
    const category = await db('categories').where({ name: 'Electricity & Power' }).first('id');
    const res = await as(student.token).post('/api/requests')
      .field('title', 'Sparking socket in Room 214')
      .field('description', 'The socket sparks when anything is plugged in.')
      .field('categoryId', String(category.id))
      .field('location', 'Hostel A (Male)')
      .field('priority', 'URGENT')
      .attach('images', PNG, { filename: 'socket.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^SR-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.priority).toBe('URGENT');
    expect(res.body.data.attachments).toHaveLength(1);

    const logs = await db('status_logs').where({ request_id: res.body.data.id });
    expect(logs).toHaveLength(1);
    const audit = await db('audit_logs').where({ action: 'REQUEST_CREATED', entity_id: res.body.data.id }).first();
    expect(audit).toBeDefined();
  });

  it('uses the category default priority when none is given', async () => {
    const created = await createRequest(staff.token);
    expect(created.priority).toBe('HIGH'); // Plumbing & Water defaults to HIGH
  });

  it('notifies administrators of a new request', async () => {
    const created = await createRequest(student.token, { title: 'Blocked sink for notification test' });
    const n = await db('notifications').where({ request_id: created.id, type: 'REQUEST_CREATED' });
    expect(n.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await as(student.token).post('/api/requests').send({ title: 'Hi', description: 'short', location: '' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'description', 'categoryId', 'location']));
  });

  it('rejects non-image uploads', async () => {
    const category = await db('categories').first('id');
    const res = await as(student.token).post('/api/requests')
      .field('title', 'Upload type test request')
      .field('description', 'Trying to upload a text file instead of an image.')
      .field('categoryId', String(category.id))
      .field('location', 'Main Library')
      .attach('images', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/JPG, PNG or WEBP/);
  });

  it('forbids officers and admins from submitting requests (403)', async () => {
    const res = await as(officer.token).post('/api/requests').send({});
    expect(res.status).toBe(403);
  });
});

describe('Listing, search, filter and pagination', () => {
  it('scopes results: a student only sees their own requests', async () => {
    const res = await as(student2.token).get('/api/requests?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((r) => r.requester_id === student2.user.id)).toBe(true);
  });

  it('scopes results: an officer only sees requests assigned to them', async () => {
    const res = await as(officer.token).get('/api/requests?limit=100');
    expect(res.body.data.every((r) => r.officer_id === officer.user.id)).toBe(true);
  });

  it('paginates', async () => {
    const res = await as(admin.token).get('/api/requests?limit=5&page=2');
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 5 });
    expect(res.body.pagination.total).toBeGreaterThan(10);
  });

  it('filters by several statuses and by priority', async () => {
    const res = await as(admin.token).get('/api/requests?status=PENDING,ASSIGNED&priority=URGENT&limit=100');
    expect(res.status).toBe(200);
    res.body.data.forEach((r) => {
      expect(['PENDING', 'ASSIGNED']).toContain(r.status);
      expect(r.priority).toBe('URGENT');
    });
  });

  it('searches by text and reference', async () => {
    const res = await as(admin.token).get('/api/requests?q=sparking socket');
    expect(res.body.data.some((r) => /sparking socket/i.test(r.title))).toBe(true);
    const { reference } = res.body.data[0];
    const byRef = await as(admin.token).get(`/api/requests?q=${reference}`);
    expect(byRef.body.data[0].reference).toBe(reference);
  });

  it('rejects an unknown status filter', async () => {
    const res = await as(admin.token).get('/api/requests?status=FLYING');
    expect(res.status).toBe(400);
  });
});

describe('Reading, updating and deleting', () => {
  it("returns 404 for another user's request", async () => {
    const mine = await createRequest(student.token);
    const res = await as(student2.token).get(`/api/requests/${mine.id}`);
    expect(res.status).toBe(404);
  });

  it('returns details with status history', async () => {
    const mine = await createRequest(student.token);
    const res = await as(student.token).get(`/api/requests/${mine.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status_logs[0].to_status).toBe('PENDING');
    expect(res.body.data.assignments).toEqual([]);
  });

  it('lets the owner edit while pending', async () => {
    const mine = await createRequest(student.token);
    const res = await as(student.token).patch(`/api/requests/${mine.id}`).send({ room: 'Room 330' });
    expect(res.status).toBe(200);
    expect(res.body.data.room).toBe('Room 330');
  });

  it('returns 400 for a malformed id', async () => {
    const res = await as(admin.token).get('/api/requests/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('lets the owner delete a pending request but not someone else', async () => {
    const mine = await createRequest(student.token);
    const other = await as(student2.token).delete(`/api/requests/${mine.id}`);
    expect(other.status).toBe(404);
    const res = await as(student.token).delete(`/api/requests/${mine.id}`);
    expect(res.status).toBe(200);
    expect(await db('service_requests').where({ id: mine.id }).first()).toBeUndefined();
  });
});

describe('Assignment and workflow', () => {
  let req;
  beforeAll(async () => {
    req = await createRequest(student.token, { title: 'Workflow test: burst pipe' });
  });

  it('only administrators can assign', async () => {
    const res = await as(student.token).post(`/api/requests/${req.id}/assign`).send({ officerId: officer.user.id });
    expect(res.status).toBe(403);
  });

  it('refuses to assign to a user who is not an officer', async () => {
    const res = await as(admin.token).post(`/api/requests/${req.id}/assign`).send({ officerId: student.user.id });
    expect(res.status).toBe(400);
  });

  it('assigns to an officer, logs it and notifies the officer and requester', async () => {
    const res = await as(admin.token).post(`/api/requests/${req.id}/assign`).send({ officerId: officer.user.id, note: 'Bring a spanner' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ASSIGNED');
    expect(res.body.data.officer_id).toBe(officer.user.id);
    const notes = await db('notifications').where({ request_id: req.id, type: 'REQUEST_ASSIGNED' }).pluck('user_id');
    expect(notes).toEqual(expect.arrayContaining([officer.user.id, student.user.id]));
  });

  it('the requester can no longer edit once assigned (409)', async () => {
    const res = await as(student.token).patch(`/api/requests/${req.id}`).send({ room: 'Room 1' });
    expect(res.status).toBe(409);
  });

  it('another officer cannot see the job', async () => {
    const res = await as(officer2.token).get(`/api/requests/${req.id}`);
    expect(res.status).toBe(404);
  });

  it('blocks invalid transitions with 409', async () => {
    const res = await as(officer.token).patch(`/api/requests/${req.id}/status`).send({ status: 'CLOSED' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Cannot change status/);
  });

  it('officer starts, holds, resumes and completes the job (with a completion photo)', async () => {
    const api = as(officer.token);
    expect((await api.patch(`/api/requests/${req.id}/status`).send({ status: 'IN_PROGRESS' })).status).toBe(200);
    expect((await api.patch(`/api/requests/${req.id}/status`).send({ status: 'ON_HOLD', comment: 'Waiting for parts' })).status).toBe(200);
    expect((await api.patch(`/api/requests/${req.id}/status`).send({ status: 'IN_PROGRESS' })).status).toBe(200);
    const done = await api.patch(`/api/requests/${req.id}/status`)
      .field('status', 'COMPLETED')
      .field('comment', 'Replaced the pipe section')
      .attach('images', PNG, { filename: 'done.png', contentType: 'image/png' });
    expect(done.status).toBe(200);
    expect(done.body.data.completed_at).not.toBeNull();
    const photo = await db('attachments').where({ request_id: req.id, kind: 'COMPLETION' }).first();
    expect(photo).toBeDefined();
  });

  it('the requester can view the completion photo, others cannot', async () => {
    const photo = await db('attachments').where({ request_id: req.id }).first('id');
    const ok = await as(student.token).get(`/api/attachments/${photo.id}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('image/png');
    const denied = await as(student2.token).get(`/api/attachments/${photo.id}`);
    expect(denied.status).toBe(404);
  });

  it('the requester confirms and rates; the request closes', async () => {
    const res = await as(student.token).patch(`/api/requests/${req.id}/status`).send({ status: 'CLOSED', rating: 5, feedback: 'Great job' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.rating).toBe(5);
    const logs = await db('status_logs').where({ request_id: req.id }).orderBy('id').pluck('to_status');
    expect(logs).toEqual(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']);
  });

  it('rejecting requires a reason', async () => {
    const r = await createRequest(student.token);
    const bad = await as(admin.token).patch(`/api/requests/${r.id}/status`).send({ status: 'REJECTED' });
    expect(bad.status).toBe(400);
    const good = await as(admin.token).patch(`/api/requests/${r.id}/status`).send({ status: 'REJECTED', comment: 'Duplicate request' });
    expect(good.status).toBe(200);
  });

  it('reassignment keeps the history and deactivates the old assignment', async () => {
    const r = await createRequest(student.token);
    await as(admin.token).post(`/api/requests/${r.id}/assign`).send({ officerId: officer.user.id });
    const res = await as(admin.token).post(`/api/requests/${r.id}/assign`).send({ officerId: officer2.user.id });
    expect(res.status).toBe(200);
    const rows = await db('assignments').where({ request_id: r.id }).orderBy('id');
    expect(rows).toHaveLength(2);
    expect(rows[0].is_active).toBe(false);
    expect(rows[1].is_active).toBe(true);
  });

  it('comments are added to the activity and notify the other party', async () => {
    const r = await createRequest(student.token);
    await as(admin.token).post(`/api/requests/${r.id}/assign`).send({ officerId: officer.user.id });
    const res = await as(officer.token).post(`/api/requests/${r.id}/comments`).send({ comment: 'I will come at 2pm' });
    expect(res.status).toBe(201);
    const n = await db('notifications').where({ request_id: r.id, user_id: student.user.id, type: 'COMMENT' }).first();
    expect(n.message).toMatch(/2pm/);
  });
});
