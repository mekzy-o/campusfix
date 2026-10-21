/** Search box and filters for the requests page. State lives in the URL query string. */
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PRIORITY, STATUS } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export const STATUS_GROUPS = {
  open: 'PENDING,ASSIGNED,IN_PROGRESS,ON_HOLD',
  done: 'COMPLETED,CLOSED',
};

export default function RequestFilters({ filters, onChange }) {
  const { user } = useAuth();
  const [q, setQ] = useState(filters.q || '');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });
  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => api.get('/users/officers').then((r) => r.data.data),
    enabled: user.role === 'ADMIN',
    staleTime: 60_000,
  });

  // Debounce typing so the list doesn't reload on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q || '') !== q) onChange({ q: q || undefined });
    }, 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = ['status', 'categoryId', 'priority', 'officerId', 'from', 'to', 'q'].some((k) => filters[k]);

  return (
    <div className="space-y-3 border-b border-line p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search requests</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, reference, location or person"
            className="input pl-9"
          />
        </label>
        <select
          aria-label="Sort"
          value={filters.sort || 'newest'}
          onChange={(e) => onChange({ sort: e.target.value === 'newest' ? undefined : e.target.value })}
          className="input md:w-48"
        >
          <option value="newest">Newest first</option>
          <option value="updated">Recently updated</option>
          <option value="priority">Highest priority</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select aria-label="Status" value={filters.status || ''} onChange={(e) => onChange({ status: e.target.value || undefined })} className="input sm:w-44">
          <option value="">Any status</option>
          <option value={STATUS_GROUPS.open}>All open</option>
          <option value={STATUS_GROUPS.done}>Completed or closed</option>
          {Object.entries(STATUS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="Category" value={filters.categoryId || ''} onChange={(e) => onChange({ categoryId: e.target.value || undefined })} className="input sm:w-48">
          <option value="">Any category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Priority" value={filters.priority || ''} onChange={(e) => onChange({ priority: e.target.value || undefined })} className="input sm:w-36">
          <option value="">Any priority</option>
          {Object.entries(PRIORITY).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </select>
        {user.role === 'ADMIN' && (
          <select aria-label="Officer" value={filters.officerId || ''} onChange={(e) => onChange({ officerId: e.target.value || undefined })} className="input sm:w-44">
            <option value="">Any officer</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">From</span>
          <input type="date" value={filters.from || ''} onChange={(e) => onChange({ from: e.target.value || undefined })} className="input py-1.5" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">To</span>
          <input type="date" value={filters.to || ''} onChange={(e) => onChange({ to: e.target.value || undefined })} className="input py-1.5" />
        </label>
        {active && (
          <button
            type="button"
            className="btn btn-ghost btn-sm col-span-2 justify-start sm:col-auto"
            onClick={() => {
              setQ('');
              onChange({
                q: undefined, status: undefined, categoryId: undefined, priority: undefined, officerId: undefined, from: undefined, to: undefined,
              });
            }}
          >
            <X className="h-4 w-4" aria-hidden /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
