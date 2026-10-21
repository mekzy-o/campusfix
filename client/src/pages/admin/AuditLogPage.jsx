/** Audit trail: who did what, when, and from where. */
import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import {
  Badge, EmptyState, PageHeader, Pagination, Spinner,
} from '../../components/ui';

const ACTION_TONE = {
  LOGIN_FAILED: 'danger',
  SESSION_REUSE_DETECTED: 'danger',
  REQUEST_DELETED: 'danger',
  USER_DEACTIVATED: 'warn',
  REQUEST_CREATED: 'bronze',
  REQUEST_ASSIGNED: 'navy',
  REQUEST_REASSIGNED: 'navy',
  REQUEST_STATUS_CHANGED: 'navy',
  DATA_EXPORTED: 'ok',
};

const readable = (action) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ');

function describe(log) {
  const d = log.details || {};
  switch (log.action) {
    case 'REQUEST_STATUS_CHANGED':
      return `${d.reference}: ${d.from} → ${d.to}${d.comment ? ` (“${d.comment}”)` : ''}`;
    case 'REQUEST_ASSIGNED':
    case 'REQUEST_REASSIGNED':
      return `${d.reference || ''}${d.officer ? ` to ${d.officer}` : d.to ? `: ${d.from} → ${d.to}` : ''}`;
    case 'REQUEST_CREATED':
      return `${d.reference} in ${d.category}`;
    case 'REQUEST_DELETED':
      return `${d.reference} “${d.title}”`;
    case 'DATA_EXPORTED':
      return `${d.count} rows as ${String(d.format).toUpperCase()}`;
    case 'USER_CREATED':
      return `${d.email} as ${d.role}`;
    case 'LOGIN_FAILED':
      return `Wrong password for ${d.email}`;
    default:
      return Object.keys(d).length ? JSON.stringify(d).slice(0, 120) : '';
  }
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '', page: 1 });
  const params = {
    action: filters.action || undefined, from: filters.from || undefined, to: filters.to || undefined, page: filters.page, limit: 20,
  };
  const { data, isLoading } = useQuery({
    queryKey: ['audit', params],
    queryFn: () => api.get('/audit-logs', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, change and export is recorded here for accountability. Entries cannot be edited." />
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <label className="text-sm">
            <span className="label">Action</span>
            <select className="input" value={filters.action} onChange={set('action')}>
              <option value="">All actions</option>
              {(data?.actions || []).map((a) => (
                <option key={a} value={a}>
                  {readable(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="label">From</span>
            <input type="date" className="input" value={filters.from} onChange={set('from')} />
          </label>
          <label className="text-sm">
            <span className="label">To</span>
            <input type="date" className="input" value={filters.to} onChange={set('to')} />
          </label>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Spinner label="Loading audit log" />
          </div>
        ) : data?.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line bg-[#f9faf8] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Who</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Details</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{log.actor_name || 'Unknown'}</p>
                      <p className="text-xs text-muted">{log.actor_role}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ACTION_TONE[log.action] || 'muted'}>{readable(log.action)}</Badge>
                    </td>
                    <td className="max-w-[340px] px-4 py-3">
                      {log.entity_type === 'service_request' && log.entity_id && log.action !== 'REQUEST_DELETED' ? (
                        <Link to={`/requests/${log.entity_id}`} className="text-navy hover:underline">
                          {describe(log)}
                        </Link>
                      ) : (
                        describe(log)
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ScrollText} title="No entries match these filters" />
        )}
        <div className="border-t border-line">
          <Pagination pagination={data?.pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
      </div>
    </>
  );
}
