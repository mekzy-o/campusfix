/** Ticket-style list of service requests, used on dashboards and the requests page. */
import { Link } from 'react-router';
import { MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isRequester, timeAgo } from '../lib/format';
import { MiniRail } from './StageRail';
import { PriorityBadge, StatusBadge } from './ui';

export default function RequestList({ requests }) {
  const { user } = useAuth();
  const showRequester = !isRequester(user);
  const showOfficer = user.role !== 'OFFICER';

  return (
    <ul className="divide-y divide-line">
      {requests.map((r) => (
        <li key={r.id}>
          <Link
            to={`/requests/${r.id}`}
            className="grid gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-[#f9faf8] focus-visible:bg-[#f9faf8] sm:grid-cols-[minmax(0,1fr)_130px_100px] sm:items-center lg:grid-cols-[minmax(0,1fr)_120px_140px_96px]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="ref-stamp">{r.reference}</span>
                <span className="truncate font-semibold">{r.title}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
                <span>{r.category_name}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {[r.location, r.room].filter(Boolean).join(', ')}
                </span>
                {showRequester && <span>by {r.requester_name}</span>}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1.5">
              <StatusBadge status={r.status} />
              <MiniRail status={r.status} />
            </div>

            <div className="hidden lg:block">
              {showOfficer && (
                <p className="truncate text-sm">
                  {r.officer_name ? r.officer_name : <span className="text-faint">Not assigned</span>}
                </p>
              )}
              <PriorityBadge priority={r.priority} />
            </div>

            <p className="text-sm text-muted sm:text-right">
              <span className="lg:hidden">
                <PriorityBadge priority={r.priority} />
                <span className="mx-2 text-line-strong sm:hidden">|</span>
              </span>
              <span className="sm:block">{timeAgo(r.updated_at)}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
