/** In-app notifications for the signed-in user. */
import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/format';
import {
  EmptyState, PageHeader, Pagination, Spinner,
} from '../components/ui';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const params = { page, limit: 15, unread: unreadOnly ? 'true' : undefined };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => api.get('/notifications', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id) => api.patch(`/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.patch('/notifications/read-all'), onSuccess: refresh });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={data ? `${data.unread} unread` : undefined}
        actions={(
          <button type="button" className="btn btn-secondary" onClick={() => markAll.mutate()} disabled={!data?.unread || markAll.isPending}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all as read
          </button>
        )}
      />
      <div className="panel overflow-hidden">
        <div className="flex gap-1 border-b border-line p-3" role="tablist">
          {[
            [false, 'All'],
            [true, 'Unread'],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={unreadOnly === value}
              onClick={() => {
                setUnreadOnly(value);
                setPage(1);
              }}
              className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold', unreadOnly === value ? 'bg-navy text-white' : 'text-muted hover:bg-[#eceee9]')}
            >
              {label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : data?.data.length ? (
          <ul className="divide-y divide-line">
            {data.data.map((n) => (
              <li key={n.id} className={clsx('relative flex gap-3 px-4 py-3.5', !n.is_read && 'bg-navy-soft/40')}>
                <span aria-hidden className={clsx('mt-2 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-bronze')} />
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-[15px]', !n.is_read && 'font-semibold')}>{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
                    <time dateTime={n.created_at} title={formatDateTime(n.created_at)}>
                      {timeAgo(n.created_at)}
                    </time>
                    {n.request_id && (
                      <Link to={`/requests/${n.request_id}`} onClick={() => !n.is_read && markRead.mutate(n.id)} className="font-semibold text-navy hover:underline">
                        Open {n.request_reference || 'request'}
                      </Link>
                    )}
                    {!n.is_read && (
                      <button type="button" onClick={() => markRead.mutate(n.id)} className="font-semibold text-muted hover:text-ink">
                        Mark as read
                      </button>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title={unreadOnly ? 'You are all caught up' : 'No notifications yet'}>
            You will be notified here when a request you are involved in changes.
          </EmptyState>
        )}
        <div className="border-t border-line">
          <Pagination pagination={data?.pagination} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}
