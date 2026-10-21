const {
  request, app, db, login, as, PASSWORD,
} = require('./helpers');

afterAll(() => db.destroy());

const cookieValue = (setCookie) => (setCookie || []).find((c) => c.startsWith('cf_refresh='));

describe('POST /api/auth/register', () => {
  const newUser = {
    fullName: 'Chioma Okeke',
    email: 'chioma.okeke@example.com',
    password: 'Secret123',
    role: 'STUDENT',
    department: 'Computer Science',
    idNumber: 'MIVA/CSC/24/0001',
  };

  it('creates a student account, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: newUser.email, role: 'STUDENT', full_name: 'Chioma Okeke' });
    expect(res.body.user.password_hash).toBeUndefined();
    const cookie = cookieValue(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('stores the password as a bcrypt hash, never in plain text', async () => {
    const row = await db('users').where({ email: newUser.email }).first('password_hash');
    expect(row.password_hash).not.toBe(newUser.password);
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: 'CHIOMA.OKEKE@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'A', email: 'not-an-email', password: 'short', role: 'STUDENT',
    });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'password']));
  });

  it('does not allow self-registration as an administrator or officer', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: 'sneaky@example.com', role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@campusfix.app', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('rejects a wrong password with a generic message and logs the failure', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@campusfix.app', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
    const log = await db('audit_logs').where({ action: 'LOGIN_FAILED' }).orderBy('id', 'desc').first();
    expect(log).toBeDefined();
  });

  it('gives the same message for an unknown email (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});

describe('Protected routes and tokens', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const { token } = await login('student');
    const res = await as(`${token}x`).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const { token } = await login('staff');
    const res = await as(token).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('STAFF');
  });
});

describe('Session refresh, rotation and logout', () => {
  it('rotates the refresh token and detects reuse of an old token', async () => {
    const { cookie } = await login('student');
    const first = cookieValue(cookie).split(';')[0];

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const second = cookieValue(refreshed.headers['set-cookie']).split(';')[0];
    expect(second).not.toBe(first);

    // Re-using the first (now revoked) token is treated as theft.
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);

    // ...and all sessions of that user are revoked, including the new one.
    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const { cookie } = await login('staff');
    const c = cookieValue(cookie).split(';')[0];
    const out = await request(app).post('/api/auth/logout').set('Cookie', c);
    expect(out.status).toBe(200);
    const again = await request(app).post('/api/auth/refresh').set('Cookie', c);
    expect(again.status).toBe(401);
  });
});

describe('Profile and password', () => {
  it('updates the profile', async () => {
    const { token } = await login('chioma.okeke@example.com', 'Secret123');
    const res = await as(token).patch('/api/auth/me').send({ phone: '08099990000', department: 'Software Engineering' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ phone: '08099990000', department: 'Software Engineering' });
  });

  it('refuses a password change with the wrong current password', async () => {
    const { token } = await login('chioma.okeke@example.com', 'Secret123');
    const res = await as(token).post('/api/auth/change-password').send({ currentPassword: 'Wrong1234', newPassword: 'NewSecret99' });
    expect(res.status).toBe(400);
  });

  it('changes the password; the old one stops working', async () => {
    const { token } = await login('chioma.okeke@example.com', 'Secret123');
    const res = await as(token).post('/api/auth/change-password').send({ currentPassword: 'Secret123', newPassword: 'NewSecret99' });
    expect(res.status).toBe(200);
    const old = await request(app).post('/api/auth/login').send({ email: 'chioma.okeke@example.com', password: 'Secret123' });
    expect(old.status).toBe(401);
    const fresh = await request(app).post('/api/auth/login').send({ email: 'chioma.okeke@example.com', password: 'NewSecret99' });
    expect(fresh.status).toBe(200);
  });
});
