/** Zod schemas for every request body / query the API accepts. */
const { z } = require('zod');
const { PRIORITIES, STATUSES, ROLES } = require('../constants');

const trimmed = (min, max, label) => z.string({ error: `${label} is required` })
  .trim()
  .min(min, `${label} must be at least ${min} characters`)
  .max(max, `${label} must be at most ${max} characters`);

const optionalText = (max) => z.string().trim().max(max).optional()
  .transform((v) => (v === '' ? undefined : v));

const password = z.string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const email = z.string({ error: 'Email is required' }).trim().toLowerCase()
  .pipe(z.email('Enter a valid email address'));

const uuid = z.uuid('Invalid identifier');
const idParam = z.object({ id: uuid });
const intId = z.coerce.number().int().positive();

// ---------- Auth ----------
const register = z.object({
  fullName: trimmed(3, 120, 'Full name'),
  email,
  password,
  role: z.enum([ROLES.STUDENT, ROLES.STAFF], { error: 'Choose Student or Staff' }),
  phone: optionalText(20),
  department: optionalText(120),
  idNumber: optionalText(40),
});

const login = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

const updateProfile = z.object({
  fullName: trimmed(3, 120, 'Full name').optional(),
  phone: optionalText(20),
  department: optionalText(120),
  idNumber: optionalText(40),
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

// ---------- Users (admin) ----------
const createUser = z.object({
  fullName: trimmed(3, 120, 'Full name'),
  email,
  password,
  role: z.enum(Object.values(ROLES)),
  phone: optionalText(20),
  department: optionalText(120),
  idNumber: optionalText(40),
  specialisation: optionalText(120),
  categoryIds: z.array(intId).optional(),
});

const updateUser = z.object({
  fullName: trimmed(3, 120, 'Full name').optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  phone: optionalText(20),
  department: optionalText(120),
  idNumber: optionalText(40),
  isActive: z.boolean().optional(),
  password: password.optional(),
  specialisation: optionalText(120),
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFF_DUTY']).optional(),
  categoryIds: z.array(intId).optional(),
});

const listUsers = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ---------- Categories ----------
const category = z.object({
  name: trimmed(2, 80, 'Name'),
  description: optionalText(255),
  icon: optionalText(40),
  defaultPriority: z.enum(PRIORITIES).optional(),
  isActive: z.boolean().optional(),
});

// ---------- Service requests ----------
const statusList = z.string().optional().transform((v, ctx) => {
  if (!v) return undefined;
  const list = v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const invalid = list.filter((s) => !STATUSES[s]);
  if (invalid.length) {
    ctx.addIssue({ code: 'custom', message: `Unknown status: ${invalid.join(', ')}` });
    return z.NEVER;
  }
  return list;
});

const requestFilters = z.object({
  q: z.string().trim().max(100).optional(),
  status: statusList,
  categoryId: intId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  officerId: uuid.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'updated']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createRequest = z.object({
  title: trimmed(5, 150, 'Title'),
  description: trimmed(10, 2000, 'Description'),
  categoryId: intId,
  location: trimmed(2, 120, 'Location'),
  room: optionalText(60),
  priority: z.enum(PRIORITIES).optional(),
});

const updateRequest = createRequest.partial();

const changeStatus = z.object({
  status: z.enum(Object.values(STATUSES)),
  comment: optionalText(1000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  feedback: optionalText(1000),
});

const assign = z.object({
  officerId: uuid,
  note: optionalText(500),
  priority: z.enum(PRIORITIES).optional(),
});

const comment = z.object({ comment: trimmed(1, 1000, 'Comment') });

// ---------- Misc ----------
const pageQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  unread: z.enum(['true', 'false']).optional(),
});

const auditQuery = z.object({
  action: z.string().trim().max(60).optional(),
  actorId: uuid.optional(),
  entityType: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const reportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const exportQuery = requestFilters.extend({
  format: z.enum(['csv', 'pdf']).default('csv'),
});

module.exports = {
  idParam,
  intIdParam: z.object({ id: intId }),
  register,
  login,
  updateProfile,
  changePassword,
  createUser,
  updateUser,
  listUsers,
  category,
  categoryUpdate: category.partial(),
  requestFilters,
  createRequest,
  updateRequest,
  changeStatus,
  assign,
  comment,
  pageQuery,
  auditQuery,
  reportQuery,
  exportQuery,
  officersQuery: z.object({ categoryId: intId.optional() }),
};
