/** Display helpers shared across the UI. */

export const STATUS = {
  PENDING: { label: 'Pending', tone: 'bronze' },
  ASSIGNED: { label: 'Assigned', tone: 'navy' },
  IN_PROGRESS: { label: 'In progress', tone: 'navy' },
  ON_HOLD: { label: 'On hold', tone: 'warn' },
  COMPLETED: { label: 'Completed', tone: 'ok' },
  CLOSED: { label: 'Closed', tone: 'muted' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const PRIORITY = {
  LOW: { label: 'Low', tone: 'muted' },
  MEDIUM: { label: 'Medium', tone: 'navy' },
  HIGH: { label: 'High', tone: 'warn' },
  URGENT: { label: 'Urgent', tone: 'danger' },
};

export const ROLE_LABEL = {
  STUDENT: 'Student',
  STAFF: 'Staff',
  OFFICER: 'Maintenance officer',
  ADMIN: 'Administrator',
};

export const OPEN_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

export const isRequester = (user) => user && (user.role === 'STUDENT' || user.role === 'STAFF');

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatDate(value) {
  return value ? dateFmt.format(new Date(value)) : '—';
}

export function formatDateTime(value) {
  return value ? dateTimeFmt.format(new Date(value)) : '—';
}

/** "3 hours ago", "2 days ago" … falls back to a date after a week. */
export function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function formatHours(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 24) return `${hours} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function initials(name = '') {
  return name
    .replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}
