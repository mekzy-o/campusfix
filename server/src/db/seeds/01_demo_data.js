/**
 * Demo data: roles, categories, users for every role and ~50 service requests
 * spread over the last six months with realistic workflow history.
 *
 * All demo accounts use the password:  CampusFix@2026
 */
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'CampusFix@2026';
const HOUR = 3600 * 1000;

// Deterministic pseudo-random generator so every reseed produces the same data.
let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const ROLES = [
  { name: 'STUDENT', label: 'Student', description: 'Registered student who can submit and track service requests' },
  { name: 'STAFF', label: 'Staff', description: 'Academic or non-academic staff who can submit and track service requests' },
  { name: 'OFFICER', label: 'Maintenance Officer', description: 'Works on assigned requests and updates their progress' },
  { name: 'ADMIN', label: 'Administrator', description: 'Manages users, assigns requests, monitors status and generates reports' },
];

const CATEGORIES = [
  { name: 'Electricity & Power', icon: 'zap', default_priority: 'HIGH', description: 'Faulty sockets, lighting, power outages, breakers' },
  { name: 'Plumbing & Water', icon: 'droplets', default_priority: 'HIGH', description: 'Leaking pipes, blocked drains, no water supply' },
  { name: 'Furniture & Fittings', icon: 'armchair', default_priority: 'LOW', description: 'Broken chairs, desks, beds, wardrobes, doors and locks' },
  { name: 'Internet & Network', icon: 'wifi', default_priority: 'MEDIUM', description: 'Wi-Fi outages, slow connection, network points' },
  { name: 'Classroom Equipment', icon: 'projector', default_priority: 'MEDIUM', description: 'Projectors, PA systems, smart boards, lecture hall equipment' },
  { name: 'Hostel Maintenance', icon: 'bed', default_priority: 'MEDIUM', description: 'General hostel room and facility repairs' },
  { name: 'Air Conditioning', icon: 'fan', default_priority: 'MEDIUM', description: 'AC units and ceiling fans not working' },
  { name: 'Building & Structural', icon: 'building', default_priority: 'MEDIUM', description: 'Roof leaks, cracked walls, windows, ceilings' },
];

const ADMINS = [
  { full_name: 'Adaeze Okonkwo', email: 'admin@campusfix.app', department: 'Works & Maintenance Department', id_number: 'STF/WMD/0012', phone: '08031234567' },
  { full_name: 'Babatunde Lawal', email: 'facilities@campusfix.app', department: 'Works & Maintenance Department', id_number: 'STF/WMD/0019', phone: '08051234567' },
];

const OFFICERS = [
  { full_name: 'Ibrahim Musa', email: 'ibrahim.musa@campusfix.app', specialisation: 'Electrician', cats: ['Electricity & Power', 'Air Conditioning'], code: 'MO-001' },
  { full_name: 'Chinedu Eze', email: 'chinedu.eze@campusfix.app', specialisation: 'Plumber', cats: ['Plumbing & Water', 'Hostel Maintenance'], code: 'MO-002' },
  { full_name: 'Tunde Bakare', email: 'tunde.bakare@campusfix.app', specialisation: 'Carpenter', cats: ['Furniture & Fittings', 'Building & Structural', 'Hostel Maintenance'], code: 'MO-003' },
  { full_name: 'Grace Effiong', email: 'grace.effiong@campusfix.app', specialisation: 'Network Technician', cats: ['Internet & Network', 'Classroom Equipment'], code: 'MO-004' },
  { full_name: 'Samuel Okafor', email: 'samuel.okafor@campusfix.app', specialisation: 'AV & HVAC Technician', cats: ['Classroom Equipment', 'Air Conditioning', 'Electricity & Power'], code: 'MO-005' },
];

const STUDENTS = [
  { full_name: 'Emeka Nwosu', email: 'student@campusfix.app', department: 'Computer Science', id_number: 'MIVA/CSC/22/0457' },
  { full_name: 'Aisha Bello', email: 'aisha.bello@campusfix.app', department: 'Nursing Science', id_number: 'MIVA/NSC/23/0112' },
  { full_name: 'Oluwaseun Adebayo', email: 'seun.adebayo@campusfix.app', department: 'Accounting', id_number: 'MIVA/ACC/22/0390' },
  { full_name: 'Blessing Udo', email: 'blessing.udo@campusfix.app', department: 'Mass Communication', id_number: 'MIVA/MAC/24/0021' },
  { full_name: 'Kelechi Obi', email: 'kelechi.obi@campusfix.app', department: 'Software Engineering', id_number: 'MIVA/SEN/23/0275' },
  { full_name: 'Fatima Abdullahi', email: 'fatima.abdullahi@campusfix.app', department: 'Economics', id_number: 'MIVA/ECO/22/0188' },
];

const STAFF = [
  { full_name: 'Dr. Folake Adeniyi', email: 'staff@campusfix.app', department: 'Department of Computer Science', id_number: 'STF/CSC/0044' },
  { full_name: 'Mr. Yusuf Garba', email: 'yusuf.garba@campusfix.app', department: 'University Library', id_number: 'STF/LIB/0071' },
  { full_name: 'Mrs. Ifeoma Chukwu', email: 'ifeoma.chukwu@campusfix.app', department: 'Bursary', id_number: 'STF/BUR/0103' },
];

const LOCATIONS = {
  student: ['Hostel A (Male)', 'Hostel B (Female)', 'Hostel C (Female)', 'Hostel D (Male)', 'Main Library', 'Faculty of Science Block', 'Student Centre', 'Cafeteria'],
  staff: ['Senate Building', 'Faculty of Science Block', 'Faculty of Engineering', 'Main Library', 'ICT Centre', 'Lecture Theatre 1', 'Lecture Theatre 2', 'Staff Quarters Block C'],
};

const ISSUES = {
  'Electricity & Power': [
    ['Sparking wall socket beside reading table', 'The socket near the window sparks whenever a plug is inserted. We have stopped using it but it is a fire risk.'],
    ['No power in the whole wing since morning', 'The left wing has had no light since around 7am. Other wings have power, so it may be a tripped breaker.'],
    ['Fluorescent tubes flickering in corridor', 'Three of the corridor lights flicker constantly and one is completely dead. The corridor is very dark at night.'],
    ['Burnt ceiling light holder', 'The ceiling light holder is burnt and the bulb no longer comes on. There is a burning smell when the switch is on.'],
  ],
  'Plumbing & Water': [
    ['Leaking pipe under the bathroom sink', 'Water has been leaking from the pipe under the sink for two days and the floor is always wet.'],
    ['No running water in the toilets', 'None of the taps or toilets on the second floor have had water since yesterday evening.'],
    ['Blocked shower drain', 'The shower drain is blocked and water collects ankle-deep each time someone baths.'],
    ['Water tank overflowing', 'The overhead tank behind the building overflows every night and wastes a lot of water.'],
  ],
  'Furniture & Fittings': [
    ['Broken bed frame', 'One of the slats on the lower bunk is broken and the mattress sinks in the middle.'],
    ['Wardrobe door off its hinges', 'The wardrobe door fell off and cannot be closed. Our belongings are exposed.'],
    ['Several broken chairs in lecture room', 'At least eight chairs in the room have broken backrests or legs. Students are standing during lectures.'],
    ['Door lock jammed', 'The room door lock is jammed and the key no longer turns. We cannot lock the room when we leave.'],
  ],
  'Internet & Network': [
    ['Wi-Fi not available on third floor', 'The campus Wi-Fi network does not show up at all on the third floor. It works downstairs.'],
    ['Very slow internet in the library', 'The library Wi-Fi is connected but pages take minutes to load, making research impossible.'],
    ['Network point not working in office', 'The LAN point in my office shows no link light. My desktop cannot connect to the internet.'],
  ],
  'Classroom Equipment': [
    ['Projector not displaying', 'The projector powers on but shows "No signal" with any laptop. Lectures have been affected all week.'],
    ['PA system producing loud noise', 'The microphone and speakers produce a loud humming noise, making it hard to hear the lecturer.'],
    ['Smart board pen not responding', 'The interactive board no longer responds to the pen or touch input.'],
  ],
  'Hostel Maintenance': [
    ['Broken window louvres in room', 'Four glass louvres in the window are broken and mosquitoes come in at night.'],
    ['Ceiling fan wobbling dangerously', 'The ceiling fan shakes heavily when switched on and looks like it may fall.'],
    ['Bathroom door cannot close', 'The bathroom door is swollen and no longer closes, so there is no privacy.'],
  ],
  'Air Conditioning': [
    ['Air conditioner leaking water', 'The split AC unit drips water onto the desk below it continuously.'],
    ['AC blowing warm air', 'The AC runs but only blows warm air. The office is very hot in the afternoons.'],
    ['Lecture hall AC not working', 'None of the AC units in the hall come on. With over 200 students the hall is unbearable.'],
  ],
  'Building & Structural': [
    ['Roof leaking during rain', 'Water drips from the ceiling whenever it rains and has damaged some books and the floor.'],
    ['Cracked wall in staircase', 'There is a long diagonal crack on the staircase wall that seems to be getting wider.'],
    ['Ceiling board falling off', 'A section of the ceiling board is sagging and partly fallen near the entrance.'],
  ],
};

const OFFICER_UPDATES = {
  IN_PROGRESS: ['Inspected the fault and started repairs.', 'On site now, diagnosing the problem.', 'Materials collected from store, work has begun.'],
  ON_HOLD: ['Waiting for replacement parts from the store.', 'Need a spare part that is out of stock; requisition raised.'],
  COMPLETED: ['Fault repaired and tested. Working properly now.', 'Replaced the faulty part and confirmed everything works.', 'Repair completed and the area has been cleaned up.'],
};

const FEEDBACK = [
  [5, 'Fixed quickly and the officer was very polite. Thank you!'],
  [4, 'Good job, though it took a couple of days.'],
  [5, 'Excellent service.'],
  [3, 'It works now but the response was slow.'],
  [4, 'Problem solved. Thanks.'],
];

exports.seed = async function seedDemo(knex) {
  // Clear in dependency order.
  await knex.raw(`TRUNCATE sessions, audit_logs, notifications, attachments, status_logs, assignments,
    service_requests, officer_categories, categories, officer_profiles, users, roles RESTART IDENTITY CASCADE`);
  await knex.raw('ALTER SEQUENCE request_ref_seq RESTART WITH 1');
  seed = 42;

  const roleRows = await knex('roles').insert(ROLES).returning(['id', 'name']);
  const roleId = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));
  const catRows = await knex('categories').insert(CATEGORIES).returning(['id', 'name']);
  const catId = Object.fromEntries(catRows.map((c) => [c.name, c.id]));

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = Date.now();
  const created = (daysAgo) => new Date(now - daysAgo * 24 * HOUR);

  const insertUsers = async (list, role, extra = {}) => knex('users').insert(list.map((u, i) => ({
    full_name: u.full_name,
    email: u.email,
    password_hash: hash,
    phone: u.phone || `080${String(31000000 + i * 7919 + role.length * 131).slice(0, 8)}`,
    department: u.department || extra.department,
    id_number: u.id_number || u.code,
    role_id: roleId[role],
    created_at: created(200 - i * 3),
    updated_at: created(200 - i * 3),
    last_login_at: created(rand() * 5),
  }))).returning(['id', 'full_name', 'email']);

  const admins = await insertUsers(ADMINS, 'ADMIN');
  const officers = await insertUsers(OFFICERS, 'OFFICER', { department: 'Works & Maintenance Department' });
  const students = await insertUsers(STUDENTS, 'STUDENT');
  const staff = await insertUsers(STAFF, 'STAFF');

  // Officer profiles (1:1) and skills (M:N).
  await knex('officer_profiles').insert(officers.map((o, i) => ({
    user_id: o.id,
    staff_code: OFFICERS[i].code,
    specialisation: OFFICERS[i].specialisation,
    availability: i === 2 ? 'BUSY' : 'AVAILABLE',
  })));
  await knex('officer_categories').insert(officers.flatMap((o, i) => OFFICERS[i].cats.map((c) => ({
    officer_id: o.id, category_id: catId[c],
  }))));

  const officersFor = (category) => officers.filter((_, i) => OFFICERS[i].cats.includes(category));
  const requesters = [...students.map((u) => ({ ...u, kind: 'student' })), ...staff.map((u) => ({ ...u, kind: 'staff' }))];

  // Status plan: older requests are mostly closed, newer ones are still open.
  const plan = [];
  const TOTAL = 52;
  for (let i = 0; i < TOTAL; i += 1) {
    // Weighted towards recent weeks so the open workload looks realistic.
    const daysAgo = Math.max(0.2, Math.round(175 * ((1 - i / TOTAL) ** 1.5) + rand() * 2));
    let status;
    if (daysAgo > 40) status = rand() < 0.85 ? 'CLOSED' : pick(['REJECTED', 'CANCELLED']);
    else if (daysAgo > 12) status = pick(['CLOSED', 'CLOSED', 'COMPLETED', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED']);
    else status = pick(['PENDING', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'ASSIGNED']);
    plan.push({ daysAgo, status });
  }
  // Keep a few clearly-defined open items for the demo accounts.
  plan[TOTAL - 1] = { daysAgo: 0.1, status: 'PENDING' };
  plan[TOTAL - 2] = { daysAgo: 0.6, status: 'PENDING' };
  plan[TOTAL - 3] = { daysAgo: 1.2, status: 'ASSIGNED' };
  plan[TOTAL - 4] = { daysAgo: 2.5, status: 'IN_PROGRESS' };
  plan[TOTAL - 6] = { daysAgo: 3.4, status: 'PENDING' };
  plan[TOTAL - 8] = { daysAgo: 5.2, status: 'ON_HOLD' };
  plan[TOTAL - 10] = { daysAgo: 6.8, status: 'PENDING' };

  const year = new Date().getFullYear();
  const audit = [];
  const notifications = [];
  const catNames = Object.keys(ISSUES);

  for (let i = 0; i < plan.length; i += 1) {
    const { daysAgo, status } = plan[i];
    // Make sure the demo student and demo staff accounts own a good share of requests.
    const requester = i % 4 === 0 ? requesters[0] : i % 7 === 0 ? requesters[students.length] : pick(requesters);
    const category = i >= TOTAL - 4 ? ['Plumbing & Water', 'Electricity & Power', 'Internet & Network', 'Furniture & Fittings'][TOTAL - 1 - i] : pick(catNames);
    const [title, description] = pick(ISSUES[category]);
    const location = pick(LOCATIONS[requester.kind]);
    const room = requester.kind === 'student' && location.startsWith('Hostel')
      ? `Room ${Math.floor(rand() * 4 + 1)}${String(Math.floor(rand() * 30 + 1)).padStart(2, '0')}`
      : pick(['Ground floor', 'First floor', 'Room 104', 'Room 212', 'Office 3', null]);
    const priority = rand() < 0.12 ? 'URGENT' : CATEGORIES.find((c) => c.name === category).default_priority;

    const t0 = created(daysAgo);
    const { rows: [{ seq }] } = await knex.raw("SELECT nextval('request_ref_seq') AS seq");
    const reference = `SR-${year}-${String(seq).padStart(5, '0')}`;

    const logs = [{ from_status: null, to_status: 'PENDING', changed_by: requester.id, comment: 'Request submitted', created_at: t0 }];
    let t = t0.getTime();
    let officer = null;
    let completedAt = null;
    let closedAt = null;
    let rating = null;
    let feedback = null;
    const admin = pick(admins);

    if (status === 'REJECTED') {
      t += (2 + rand() * 20) * HOUR;
      logs.push({ from_status: 'PENDING', to_status: 'REJECTED', changed_by: admin.id, comment: 'Duplicate of an existing request for the same location.', created_at: new Date(t) });
    } else if (status === 'CANCELLED') {
      t += (1 + rand() * 10) * HOUR;
      logs.push({ from_status: 'PENDING', to_status: 'CANCELLED', changed_by: requester.id, comment: 'Issue resolved itself, no longer needed.', created_at: new Date(t) });
    } else if (status !== 'PENDING') {
      officer = pick(officersFor(category));
      t += (1 + rand() * (priority === 'URGENT' ? 3 : 18)) * HOUR;
      logs.push({ from_status: 'PENDING', to_status: 'ASSIGNED', changed_by: admin.id, comment: `Assigned to ${officer.full_name}`, created_at: new Date(t), assignedAt: true });
      if (['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED'].includes(status)) {
        t += (1 + rand() * 12) * HOUR;
        logs.push({ from_status: 'ASSIGNED', to_status: 'IN_PROGRESS', changed_by: officer.id, comment: pick(OFFICER_UPDATES.IN_PROGRESS), created_at: new Date(t) });
      }
      if (status === 'ON_HOLD') {
        t += (2 + rand() * 24) * HOUR;
        logs.push({ from_status: 'IN_PROGRESS', to_status: 'ON_HOLD', changed_by: officer.id, comment: pick(OFFICER_UPDATES.ON_HOLD), created_at: new Date(t) });
      }
      if (['COMPLETED', 'CLOSED'].includes(status)) {
        t += (2 + rand() * 40) * HOUR;
        completedAt = new Date(t);
        logs.push({ from_status: 'IN_PROGRESS', to_status: 'COMPLETED', changed_by: officer.id, comment: pick(OFFICER_UPDATES.COMPLETED), created_at: completedAt });
      }
      if (status === 'CLOSED') {
        t += (3 + rand() * 30) * HOUR;
        closedAt = new Date(t);
        [rating, feedback] = pick(FEEDBACK);
        logs.push({ from_status: 'COMPLETED', to_status: 'CLOSED', changed_by: requester.id, comment: `Confirmed fixed. Rated ${rating}/5.`, created_at: closedAt });
      }
    }
    const updatedAt = new Date(Math.min(t, now));

    const [request] = await knex('service_requests').insert({
      reference, title, description, category_id: catId[category], requester_id: requester.id,
      location, room, priority, status,
      completed_at: completedAt, closed_at: closedAt, rating, feedback,
      created_at: t0, updated_at: updatedAt,
    }).returning(['id']);

    const assignedLog = logs.find((l) => l.assignedAt);
    if (officer) {
      await knex('assignments').insert({
        request_id: request.id, officer_id: officer.id, assigned_by: admin.id, is_active: true,
        note: priority === 'URGENT' ? 'Urgent — please attend today.' : null,
        assigned_at: assignedLog.created_at,
      });
      notifications.push({
        user_id: officer.id, type: 'REQUEST_ASSIGNED', title: `New job: ${reference}`,
        message: `You have been assigned "${title}" at ${location}.`, request_id: request.id,
        is_read: daysAgo > 3, created_at: assignedLog.created_at,
      });
      notifications.push({
        user_id: requester.id, type: 'REQUEST_ASSIGNED', title: `Request ${reference} assigned`,
        message: `${officer.full_name} has been assigned to your request "${title}".`, request_id: request.id,
        is_read: daysAgo > 3, created_at: assignedLog.created_at,
      });
    }
    await knex('status_logs').insert(logs.map(({ assignedAt, ...l }) => ({ ...l, request_id: request.id })));

    logs.forEach((l, idx) => {
      audit.push({
        actor_id: l.changed_by,
        action: idx === 0 ? 'REQUEST_CREATED' : (l.to_status === 'ASSIGNED' ? 'REQUEST_ASSIGNED' : 'REQUEST_STATUS_CHANGED'),
        entity_type: 'service_request',
        entity_id: request.id,
        details: JSON.stringify(idx === 0 ? { reference, category } : { reference, from: l.from_status, to: l.to_status }),
        ip_address: `102.89.${Math.floor(rand() * 200)}.${Math.floor(rand() * 250)}`,
        user_agent: 'Mozilla/5.0 (seed data)',
        created_at: l.created_at,
      });
    });
    if (status === 'COMPLETED') {
      notifications.push({
        user_id: requester.id, type: 'STATUS_CHANGED', title: 'Request completed',
        message: `${reference} "${title}" is now Completed. Please confirm the fix.`, request_id: request.id,
        is_read: false, created_at: completedAt,
      });
    }
    if (status === 'PENDING') {
      admins.forEach((a) => notifications.push({
        user_id: a.id, type: 'REQUEST_CREATED', title: `New request ${reference}`,
        message: `${requester.full_name} reported "${title}" at ${location} (${category}).`, request_id: request.id,
        is_read: false, created_at: t0,
      }));
    }
  }

  await knex('notifications').insert(notifications);

  // A few log-ins / user-management events so the audit trail shows more than requests.
  [...admins, ...officers.slice(0, 2), students[0], staff[0]].forEach((u, i) => {
    audit.push({
      actor_id: u.id, action: 'USER_LOGIN', entity_type: 'user', entity_id: u.id, details: null,
      ip_address: `105.112.${40 + i}.${17 + i * 3}`, user_agent: 'Mozilla/5.0 (seed data)', created_at: created(rand() * 2),
    });
  });
  officers.forEach((o) => audit.push({
    actor_id: admins[0].id, action: 'USER_CREATED', entity_type: 'user', entity_id: o.id,
    details: JSON.stringify({ email: o.email, role: 'OFFICER' }), ip_address: '105.112.40.17', user_agent: 'Mozilla/5.0 (seed data)', created_at: created(190),
  }));
  for (let i = 0; i < audit.length; i += 200) {
    // eslint-disable-next-line no-await-in-loop
    await knex('audit_logs').insert(audit.slice(i, i + 200));
  }
};

exports.DEMO_PASSWORD = DEMO_PASSWORD;
