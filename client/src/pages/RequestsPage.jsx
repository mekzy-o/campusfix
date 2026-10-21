/**
 * Request tracking page. The same page serves every role:
 * requesters see their own requests, officers their jobs, admins everything.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Download, FileText, Plus } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../lib/api';
import { isRequester } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import RequestList from '../components/RequestList';
import RequestFilters from '../components/RequestFilters';
import {
  EmptyState, ErrorBox, PageHeader, Pagination, Spinner,
} from '../components/ui';

const FILTER_KEYS = ['q', 'status', 'categoryId', 'priority', 'officerId', 'from', 'to', 'sort', 'page'];

export default function RequestsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exporting, setExporting] = useState(null);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) || undefined]));
  const params = { ...filters, limit: 10 };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['requests', params],
    queryFn: () => api.get('/requests', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const exportAs = async (format) => {
    setExporting(format);
    try {
      const { page, ...rest } = filters;
      await downloadFile('/reports/export', { ...rest, format }, `campusfix-requests.${format}`);
      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const title = user.role === 'ADMIN' ? 'All requests' : user.role === 'OFFICER' ? 'My jobs' : 'My requests';
  const description = user.role === 'ADMIN'
    ? 'Every service request across campus. Open one to assign it or change its status.'
    : user.role === 'OFFICER'
      ? 'Requests assigned to you. Open a job to update its progress.'
      : 'Everything you have reported and where it stands.';

  const canExport = user.role === 'ADMIN' || user.role === 'OFFICER';
  const hasFilters = ['q', 'status', 'categoryId', 'priority', 'officerId', 'from', 'to'].some((k) => filters[k]);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={(
          <>
            {canExport && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')} disabled={Boolean(exporting)}>
                  <Download className="h-4 w-4" aria-hidden /> {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => exportAs('pdf')} disabled={Boolean(exporting)}>
                  <FileText className="h-4 w-4" aria-hidden /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
                </button>
              </>
            )}
            {isRequester(user) && (
              <Link to="/requests/new" className="btn btn-primary">
                <Plus className="h-4 w-4" aria-hidden /> Report a problem
              </Link>
            )}
          </>
        )}
      />

      <div className="panel overflow-hidden">
        <RequestFilters filters={filters} onChange={update} />
        {error && (
          <div className="p-4">
            <ErrorBox>{errorMessage(error)}</ErrorBox>
          </div>
        )}
        {isLoading ? (
          <div className="p-8 text-center">
            <Spinner label="Loading requests" />
          </div>
        ) : data?.data.length ? (
          <div className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
            <RequestList requests={data.data} />
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No requests match these filters' : user.role === 'OFFICER' ? 'No jobs assigned to you yet' : 'No requests yet'}
            action={
              hasFilters ? null : isRequester(user) ? (
                <Link to="/requests/new" className="btn btn-primary">
                  Report a problem
                </Link>
              ) : null
            }
          >
            {hasFilters
              ? 'Try removing a filter or searching for something else.'
              : isRequester(user)
                ? 'When something on campus needs fixing, report it here and track it to completion.'
                : 'New work will appear here as soon as it is assigned.'}
          </EmptyState>
        )}
        <div className="border-t border-line">
          <Pagination pagination={data?.pagination} onPage={(p) => update({ page: String(p) })} />
        </div>
      </div>
    </>
  );
}
