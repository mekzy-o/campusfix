/**
 * Dashboards, administrative reports and data export (CSV / PDF).
 */
const PDFDocument = require('pdfkit');
const db = require('../db');
const { ROLES, REQUESTER_ROLES } = require('../constants');
const { logAudit } = require('../services/audit');
const {
  applyVisibility, applyFilters, baseListQuery, applySort, LIST_COLUMNS,
} = require('../services/requestQueries');
const { STATUS_LABELS } = require('./requests.controller');

const OPEN = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

function countBy(rows, key) {
  return rows.reduce((acc, r) => ({ ...acc, [r[key]]: Number(r.count) }), {});
}

function dateRange(q, column, { from, to } = {}) {
  if (from) q.where(column, '>=', from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    q.where(column, '<=', end);
  }
  return q;
}

/** Role-aware headline numbers for the dashboard home page. */
async function dashboard(req, res) {
  const { user } = req;
  const scoped = () => applyVisibility(baseListQuery(), user);

  const byStatusRows = await scoped().clone().groupBy('sr.status').select('sr.status').count('sr.id as count');
  const byStatus = countBy(byStatusRows, 'status');
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const recent = await applySort(scoped().select(LIST_COLUMNS), 'updated').limit(6);
  const data = {
    role: user.role,
    total,
    byStatus,
    open: OPEN.reduce((n, s) => n + (byStatus[s] || 0), 0),
    recent,
  };

  if (user.role === ROLES.OFFICER) {
    const [{ count }] = await scoped().where('sr.status', 'COMPLETED')
      .where('sr.completed_at', '>=', db.raw("date_trunc('month', now())")).count('sr.id as count');
    data.completedThisMonth = Number(count);
    data.urgentOpen = Number((await scoped().whereIn('sr.status', OPEN).where('sr.priority', 'URGENT')
      .count('sr.id as count'))[0].count);
  }

  if (user.role === ROLES.ADMIN) {
    data.unassigned = byStatus.PENDING || 0;
    data.urgentOpen = Number((await scoped().whereIn('sr.status', OPEN).where('sr.priority', 'URGENT')
      .count('sr.id as count'))[0].count);
    const users = await db('users').join('roles', 'roles.id', 'users.role_id')
      .where('users.is_active', true).groupBy('roles.name').select('roles.name').count('users.id as count');
    data.usersByRole = countBy(users, 'name');
    const [avg] = await db('service_requests').whereNotNull('completed_at')
      .select(db.raw('round(avg(extract(epoch FROM (completed_at - created_at)) / 3600)::numeric, 1) AS hours'));
    data.avgResolutionHours = avg.hours ? Number(avg.hours) : null;
  }

  if (REQUESTER_ROLES.includes(user.role)) {
    data.awaitingConfirmation = byStatus.COMPLETED || 0;
  }

  res.json({ data });
}

/** Administrative summary report used on the Reports page. */
async function summary(req, res) {
  const range = req.validQuery || {};
  const scoped = () => dateRange(db('service_requests as sr'), 'sr.created_at', range);

  const [byStatus, byPriority, byCategory, monthly, officers, totals] = await Promise.all([
    scoped().groupBy('sr.status').select('sr.status').count('sr.id as count'),
    scoped().groupBy('sr.priority').select('sr.priority').count('sr.id as count'),
    scoped().join('categories as c', 'c.id', 'sr.category_id')
      .groupBy('c.name').select('c.name')
      .count('sr.id as count')
      .select(db.raw("count(*) FILTER (WHERE sr.status IN ('COMPLETED','CLOSED'))::int AS resolved"))
      .orderBy('count', 'desc'),
    db.raw(`
      WITH months AS (
        SELECT generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m
      )
      SELECT to_char(m, 'Mon YYYY') AS month,
             (SELECT count(*) FROM service_requests WHERE date_trunc('month', created_at) = m)::int AS submitted,
             (SELECT count(*) FROM service_requests WHERE date_trunc('month', completed_at) = m)::int AS completed
      FROM months ORDER BY m`),
    db('users as u').join('roles as r', 'r.id', 'u.role_id')
      .leftJoin('assignments as a', function j() { this.on('a.officer_id', 'u.id').andOn('a.is_active', db.raw('true')); })
      .leftJoin('service_requests as sr', 'sr.id', 'a.request_id')
      .where('r.name', ROLES.OFFICER)
      .groupBy('u.id', 'u.full_name')
      .select('u.id', 'u.full_name')
      .select(db.raw('count(sr.id)::int AS assigned'))
      .select(db.raw("count(sr.id) FILTER (WHERE sr.status IN ('ASSIGNED','IN_PROGRESS','ON_HOLD'))::int AS open"))
      .select(db.raw("count(sr.id) FILTER (WHERE sr.status IN ('COMPLETED','CLOSED'))::int AS resolved"))
      .select(db.raw('round(avg(extract(epoch FROM (sr.completed_at - a.assigned_at)) / 3600)::numeric, 1) AS avg_hours'))
      .select(db.raw('round(avg(sr.rating)::numeric, 1) AS avg_rating'))
      .orderBy('resolved', 'desc'),
    scoped().first(
      db.raw('count(*)::int AS total'),
      db.raw("count(*) FILTER (WHERE status IN ('COMPLETED','CLOSED'))::int AS resolved"),
      db.raw("count(*) FILTER (WHERE status IN ('PENDING','ASSIGNED','IN_PROGRESS','ON_HOLD'))::int AS open"),
      db.raw('round(avg(extract(epoch FROM (completed_at - created_at)) / 3600)::numeric, 1) AS avg_resolution_hours'),
      db.raw('round(avg(rating)::numeric, 2) AS avg_rating'),
      db.raw('count(rating)::int AS ratings'),
    ),
  ]);

  res.json({
    data: {
      totals: {
        ...totals,
        avg_resolution_hours: totals.avg_resolution_hours ? Number(totals.avg_resolution_hours) : null,
        avg_rating: totals.avg_rating ? Number(totals.avg_rating) : null,
        resolution_rate: totals.total ? Math.round((totals.resolved / totals.total) * 100) : 0,
      },
      byStatus: countBy(byStatus, 'status'),
      byPriority: countBy(byPriority, 'priority'),
      byCategory: byCategory.map((r) => ({ name: r.name, count: Number(r.count), resolved: r.resolved })),
      monthly: monthly.rows,
      officers: officers.map((o) => ({
        ...o,
        avg_hours: o.avg_hours ? Number(o.avg_hours) : null,
        avg_rating: o.avg_rating ? Number(o.avg_rating) : null,
      })),
    },
  });
}

// ---------------------------------------------------------------- EXPORT

const fmtDate = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '');

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote cells and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = ['Reference', 'Title', 'Category', 'Location', 'Room', 'Priority', 'Status',
    'Requester', 'Assigned officer', 'Submitted', 'Completed', 'Rating'];
  const lines = rows.map((r) => [
    r.reference, r.title, r.category_name, r.location, r.room, r.priority, STATUS_LABELS[r.status],
    r.requester_name, r.officer_name, fmtDate(r.created_at), fmtDate(r.completed_at), r.rating,
  ].map(csvCell).join(','));
  return `﻿${headers.map(csvCell).join(',')}\r\n${lines.join('\r\n')}\r\n`;
}

function toPdf(rows, res, meta) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text('CampusFix: Service Request Report');
  doc.moveDown(0.2).fontSize(9).font('Helvetica').fillColor('#555')
    .text(`Generated ${fmtDate(new Date())} UTC by ${meta.by}. ${rows.length} request(s).${meta.filters ? ` Filters: ${meta.filters}.` : ''}`);
  doc.moveDown(0.8).fillColor('#000');

  const cols = [
    ['Reference', 78], ['Title', 170], ['Category', 90], ['Location', 110], ['Priority', 55],
    ['Status', 70], ['Officer', 100], ['Submitted', 95],
  ];
  const startX = doc.page.margins.left;
  const drawHeader = () => {
    let x = startX;
    const y = doc.y;
    doc.rect(startX, y - 3, cols.reduce((a, [, w]) => a + w, 0), 16).fill('#12395A');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    cols.forEach(([label, w]) => { doc.text(label, x + 3, y, { width: w - 6 }); x += w; });
    doc.fillColor('#000').font('Helvetica');
    doc.y = y + 16;
  };

  drawHeader();
  rows.forEach((r, i) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      drawHeader();
    }
    const values = [r.reference, r.title, r.category_name, [r.location, r.room].filter(Boolean).join(', '),
      r.priority, STATUS_LABELS[r.status], r.officer_name || '—', fmtDate(r.created_at)];
    const y = doc.y;
    if (i % 2 === 0) doc.rect(startX, y - 2, cols.reduce((a, [, w]) => a + w, 0), 14).fill('#F1F5F9').fillColor('#000');
    let x = startX;
    doc.fontSize(7.5);
    values.forEach((v, idx) => {
      doc.text(String(v ?? ''), x + 3, y, { width: cols[idx][1] - 6, height: 11, ellipsis: true, lineBreak: false });
      x += cols[idx][1];
    });
    doc.y = y + 14;
  });

  if (rows.length === 0) doc.fontSize(10).text('No requests match the selected filters.');
  doc.end();
}

async function exportRequests(req, res) {
  const { format, ...filters } = req.validQuery || {};
  const query = applySort(applyFilters(applyVisibility(baseListQuery(), req.user), filters).select(LIST_COLUMNS), filters.sort)
    .limit(5000);
  const rows = await query;
  const stamp = new Date().toISOString().slice(0, 10);

  await logAudit(req, {
    action: 'DATA_EXPORTED', entityType: 'service_request', details: { format, count: rows.length, filters },
  });

  if (format === 'pdf') {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="campusfix-requests-${stamp}.pdf"`,
    });
    const described = Object.entries(filters)
      .filter(([k, v]) => v !== undefined && !['page', 'limit', 'sort'].includes(k))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : (v instanceof Date ? v.toISOString().slice(0, 10) : v)}`)
      .join(', ');
    return toPdf(rows, res, { by: req.user.full_name, filters: described });
  }

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="campusfix-requests-${stamp}.csv"`,
  });
  return res.send(toCsv(rows));
}

module.exports = {
  dashboard, summary, exportRequests, toCsv,
};
