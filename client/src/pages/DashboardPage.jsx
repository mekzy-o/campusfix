/**
 * Role-based dashboard. Students/staff, maintenance officers and
 * administrators each get a home page built around their own work.
 */
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CircleAlert, ClipboardList, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS, formatHours } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import RequestList from '../components/RequestList';
import { EmptyState, PageHeader, PageLoader } from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** The status board: one cell per workflow stage, each linking to the filtered list. */
function StatusBoard({ cells }) {
  return (
    <div className="panel grid grid-cols-2 divide-line overflow-hidden sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
      {cells.map((c, i) => (
        <Link
          key={c.label}
          to={c.to}
          className={clsx(
            'group relative block px-4 py-4 hover:bg-[#f9faf8] sm:px-5',
            i % 2 === 1 && 'border-l border-line sm:border-l-0',
            i >= 2 && 'border-t border-line sm:border-t-0',
            i >= 3 && 'sm:border-t lg:border-t-0',
          )}
        >
          {c.highlight && <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-bronze" />}
          <span className="block text-[2rem] leading-none font-bold [font-stretch:80%]">{c.value}</span>
          <span className="mt-1.5 block text-sm font-semibold">{c.label}</span>
          {c.hint && <span className="block text-xs text-muted">{c.hint}</span>}
        </Link>
      ))}
    </div>
  );
}

function Section({ title, link, children }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {link && (
          <Link to={link.to} className="text-sm font-semibold text-navy hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function RequesterDashboard({ user, data }) {
  const s = data.byStatus;
  const awaiting = data.awaitingConfirmation;
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.full_name.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/, '').split(' ')[0]}`}
        description="Report anything on campus that needs fixing and follow it until it is done."
        actions={(
          <Link to="/requests/new" className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Report a problem
          </Link>
        )}
      />
      {awaiting > 0 && (
        <Link to="/requests?status=COMPLETED" className="mb-6 flex items-start gap-3 rounded-lg border border-[#bcdcc8] bg-ok-soft px-4 py-3 text-ok hover:border-ok">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">
              {awaiting} repair{awaiting > 1 ? 's are' : ' is'} waiting for your confirmation.
            </span>{' '}
            Check the work and close the request, or reopen it if the problem is still there.
          </span>
        </Link>
      )}
      <StatusBoard
        cells={[
          { label: 'Waiting for review', value: s.PENDING || 0, to: '/requests?status=PENDING', hint: 'Not yet assigned', highlight: (s.PENDING || 0) > 0 },
          { label: 'Being worked on', value: (s.ASSIGNED || 0) + (s.IN_PROGRESS || 0) + (s.ON_HOLD || 0), to: '/requests?status=ASSIGNED,IN_PROGRESS,ON_HOLD', hint: 'Assigned or in progress' },
          { label: 'Ready to confirm', value: s.COMPLETED || 0, to: '/requests?status=COMPLETED', hint: 'Marked completed' },
          { label: 'Closed', value: s.CLOSED || 0, to: '/requests?status=CLOSED', hint: 'Fixed and confirmed' },
          { label: 'All requests', value: data.total, to: '/requests' },
        ]}
      />
      <div className="mt-6">
        <Section title="Recent activity" link={{ to: '/requests', label: 'View all' }}>
          {data.recent.length ? (
            <RequestList requests={data.recent} />
          ) : (
            <EmptyState icon={ClipboardList} title="You haven't reported anything yet" action={<Link to="/requests/new" className="btn btn-primary">Report a problem</Link>}>
              Faulty sockets, leaking pipes, broken furniture or Wi-Fi problems can all be reported and tracked here.
            </EmptyState>
          )}
        </Section>
      </div>
    </>
  );
}

function OfficerDashboard({ user, data }) {
  const s = data.byStatus;
  const { data: queue } = useQuery({
    queryKey: ['requests', { queue: true }],
    queryFn: () => api.get('/requests', { params: { status: 'ASSIGNED,IN_PROGRESS,ON_HOLD', sort: 'priority', limit: 8 } }).then((r) => r.data.data),
  });
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.full_name.split(' ')[0]}`} description="Your assigned jobs, most urgent first." />
      <StatusBoard
        cells={[
          { label: 'New jobs', value: s.ASSIGNED || 0, to: '/requests?status=ASSIGNED', hint: 'Not started', highlight: (s.ASSIGNED || 0) > 0 },
          { label: 'In progress', value: s.IN_PROGRESS || 0, to: '/requests?status=IN_PROGRESS' },
          { label: 'On hold', value: s.ON_HOLD || 0, to: '/requests?status=ON_HOLD', hint: 'Waiting on parts or access' },
          { label: 'Urgent open', value: data.urgentOpen || 0, to: '/requests?priority=URGENT&status=ASSIGNED,IN_PROGRESS,ON_HOLD' },
          { label: 'Completed this month', value: data.completedThisMonth || 0, to: '/requests?status=COMPLETED,CLOSED' },
        ]}
      />
      <div className="mt-6">
        <Section title="Your queue" link={{ to: '/requests', label: 'All my jobs' }}>
          {queue?.length ? (
            <RequestList requests={queue} />
          ) : (
            <EmptyState icon={ClipboardList} title="Your queue is clear">
              New jobs will appear here, and you will be notified as soon as one is assigned to you.
            </EmptyState>
          )}
        </Section>
      </div>
    </>
  );
}

function AdminDashboard({ user, data }) {
  const s = data.byStatus;
  const { data: unassigned } = useQuery({
    queryKey: ['requests', { unassigned: true }],
    queryFn: () => api.get('/requests', { params: { status: 'PENDING', sort: 'priority', limit: 6 } }).then((r) => r.data.data),
  });
  const users = data.usersByRole || {};
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.full_name.split(' ')[0]}`}
        description="Campus maintenance at a glance."
        actions={(
          <Link to="/reports" className="btn btn-secondary">
            View reports
          </Link>
        )}
      />
      <StatusBoard
        cells={[
          { label: 'Needs assignment', value: s.PENDING || 0, to: '/requests?status=PENDING', hint: 'Pending review', highlight: (s.PENDING || 0) > 0 },
          { label: STATUS.ASSIGNED.label, value: s.ASSIGNED || 0, to: '/requests?status=ASSIGNED', hint: 'Not started yet' },
          { label: 'In progress', value: (s.IN_PROGRESS || 0) + (s.ON_HOLD || 0), to: '/requests?status=IN_PROGRESS,ON_HOLD', hint: `${s.ON_HOLD || 0} on hold` },
          { label: 'Awaiting confirmation', value: s.COMPLETED || 0, to: '/requests?status=COMPLETED', hint: 'Completed by officer' },
          { label: 'Urgent open', value: data.urgentOpen || 0, to: '/requests?priority=URGENT&status=PENDING,ASSIGNED,IN_PROGRESS,ON_HOLD', hint: 'Safety or major outage' },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Section title="Needs assignment" link={{ to: '/requests?status=PENDING', label: 'View all pending' }}>
            {unassigned?.length ? (
              <RequestList requests={unassigned} />
            ) : (
              <EmptyState icon={ClipboardList} title="Nothing waiting">
                Every request has been assigned to an officer.
              </EmptyState>
            )}
          </Section>
          <Section title="Recently updated" link={{ to: '/requests?sort=updated', label: 'View all' }}>
            <RequestList requests={data.recent} />
          </Section>
        </div>
        <aside className="space-y-6">
          <section className="panel p-5">
            <h2 className="text-lg font-bold">Performance</h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-sm text-muted">Average time to complete</dt>
                <dd className="text-2xl font-bold [font-stretch:80%]">{formatHours(data.avgResolutionHours)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Requests logged</dt>
                <dd className="text-2xl font-bold [font-stretch:80%]">{data.total}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Open right now</dt>
                <dd className="text-2xl font-bold [font-stretch:80%]">{data.open}</dd>
              </div>
            </dl>
          </section>
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Active users</h2>
              <Link to="/users" className="text-sm font-semibold text-navy hover:underline">
                Manage
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ['STUDENT', 'Students'],
                ['STAFF', 'Staff'],
                ['OFFICER', 'Maintenance officers'],
                ['ADMIN', 'Administrators'],
              ].map(([key, label]) => (
                <li key={key} className="flex justify-between">
                  <Link to={`/users?role=${key}`} className="hover:underline">
                    {label}
                  </Link>
                  <span className="font-semibold">{users[key] || 0}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
  });
  if (isLoading || !data) return <PageLoader />;
  if (user.role === 'ADMIN') return <AdminDashboard user={user} data={data} />;
  if (user.role === 'OFFICER') return <OfficerDashboard user={user} data={data} />;
  return <RequesterDashboard user={user} data={data} />;
}
