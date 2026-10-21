/** A single service request: progress, details, photos, history and actions. */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, ImagePlus, Mail, MapPin, MessageSquare, Phone, Send,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import {
  STATUS, formatDateTime, isRequester, timeAgo,
} from '../lib/format';
import { validateImages } from '../lib/schemas';
import { useAuth } from '../context/AuthContext';
import StageRail from '../components/StageRail';
import RequestActions from '../components/RequestActions';
import {
  AuthImage, Avatar, EmptyState, ErrorBox, PageLoader, PriorityBadge, Stars, StatusBadge,
} from '../components/ui';

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

function Photos({ request, canUpload }) {
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState(null);
  const upload = useMutation({
    mutationFn: (files) => {
      const form = new FormData();
      files.forEach((f) => form.append('images', f));
      return api.post(`/requests/${request.id}/attachments`, form).then((r) => r.data);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const groups = [
    ['EVIDENCE', 'Reported fault'],
    ['COMPLETION', 'Completed work'],
  ].map(([kind, label]) => [label, request.attachments.filter((a) => a.kind === kind)]);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Photos</h2>
        {canUpload && (
          <label className="btn btn-secondary btn-sm cursor-pointer">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {upload.isPending ? 'Uploading…' : 'Add photos'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              disabled={upload.isPending}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                const problem = validateImages(files);
                if (problem) toast.error(problem);
                else if (files.length) upload.mutate(files);
              }}
            />
          </label>
        )}
      </div>
      {request.attachments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No photos were attached.</p>
      ) : (
        groups.filter(([, list]) => list.length).map(([label, list]) => (
          <div key={label} className="mt-3">
            <p className="mb-2 text-sm font-semibold text-muted">{label}</p>
            <div className="flex flex-wrap gap-3">
              {list.map((a) => (
                <button key={a.id} type="button" onClick={() => setViewing(a)} className="overflow-hidden rounded-md border border-line" aria-label={`View ${a.filename}`}>
                  <AuthImage id={a.id} alt={a.filename} className="h-28 w-28 sm:h-32 sm:w-32" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-label={viewing.filename} onClick={() => setViewing(null)} onKeyDown={(e) => e.key === 'Escape' && setViewing(null)}>
          <AuthImage id={viewing.id} alt={viewing.filename} className="max-h-[85vh] max-w-full rounded-md !object-contain" />
          <button type="button" className="btn btn-secondary absolute top-4 right-4" autoFocus onClick={() => setViewing(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}

function Activity({ request }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const closed = ['CLOSED', 'CANCELLED'].includes(request.status);
  const mutation = useMutation({
    mutationFn: () => api.post(`/requests/${request.id}/comments`, { comment: comment.trim() }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const entries = [...request.status_logs].reverse();

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-bold">Activity</h2>
      {!closed && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) mutation.mutate();
          }}
        >
          <label htmlFor="comment" className="sr-only">
            Add a comment
          </label>
          <input id="comment" className="input" placeholder="Add a comment or update" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <button type="submit" className="btn btn-primary" disabled={!comment.trim() || mutation.isPending} aria-label="Post comment">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      <ol className="mt-5 space-y-0">
        {entries.map((log, i) => {
          const isComment = log.from_status === log.to_status;
          return (
            <li key={log.id} className="relative flex gap-3 pb-5">
              {i < entries.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[17px] w-px bg-line" />}
              <Avatar name={log.changed_by_name || 'System'} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm">
                  <span className="font-semibold">{log.changed_by_name || 'System'}</span>
                  {log.changed_by_role && <span className="text-muted">, {log.changed_by_role}</span>}
                  <time className="ml-2 text-faint" dateTime={log.created_at} title={formatDateTime(log.created_at)}>
                    {timeAgo(log.created_at)}
                  </time>
                </p>
                {isComment ? (
                  <p className="mt-1 flex items-start gap-1.5 text-sm">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                    {log.comment}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {log.from_status ? 'Changed status to' : 'Submitted as'} <StatusBadge status={log.to_status} />
                    </p>
                    {log.comment && log.comment !== 'Request submitted' && <p className="mt-1.5 rounded-md bg-[#f3f5f1] px-3 py-2 text-sm">{log.comment}</p>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: request, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn: () => api.get(`/requests/${id}`).then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;
  if (error) {
    return error.response?.status === 404 ? (
      <EmptyState title="Request not found" action={<Link to="/requests" className="btn btn-primary">Back to requests</Link>}>
        It may have been deleted, or you do not have access to it.
      </EmptyState>
    ) : (
      <ErrorBox>{errorMessage(error)}</ErrorBox>
    );
  }

  const canUpload = !['CLOSED', 'CANCELLED', 'REJECTED'].includes(request.status)
    && (user.role === 'ADMIN' || user.role === 'OFFICER' || request.requester_id === user.id);
  const showContact = !isRequester(user);

  return (
    <>
      <Link to="/requests" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {user.role === 'OFFICER' ? 'My jobs' : user.role === 'ADMIN' ? 'All requests' : 'My requests'}
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ref-stamp">{request.reference}</span>
          <StatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
        </div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{request.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Reported by {request.requester_id === user.id ? 'you' : request.requester_name} on {formatDateTime(request.created_at)}
        </p>
      </header>

      <StageRail status={request.status} logs={request.status_logs} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="text-lg font-bold">Problem description</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-line">{request.description}</p>
            {request.status === 'CLOSED' && request.rating && (
              <div className="mt-4 rounded-md border border-line bg-[#f9faf8] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Requester rating <Stars value={request.rating} size="sm" />
                </p>
                {request.feedback && <p className="mt-1 text-sm text-muted">&ldquo;{request.feedback}&rdquo;</p>}
              </div>
            )}
          </section>
          <Photos request={request} canUpload={canUpload} />
          <Activity request={request} />
        </div>

        <aside className="order-first space-y-6 lg:order-none">
          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-bold">{STATUS[request.status].label === 'Closed' ? 'Summary' : 'What next'}</h2>
            <RequestActions request={request} />
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-bold">Details</h2>
            <dl className="mt-1 divide-y divide-line">
              <DetailRow label="Category">{request.category_name}</DetailRow>
              <DetailRow label="Location">
                <span className="inline-flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  {[request.location, request.room].filter(Boolean).join(', ')}
                </span>
              </DetailRow>
              <DetailRow label="Officer">
                {request.officer_name ? (
                  <>
                    {request.officer_name}
                    <span className="block text-xs font-normal text-muted">since {formatDateTime(request.assigned_at)}</span>
                  </>
                ) : (
                  <span className="text-faint">Not assigned yet</span>
                )}
              </DetailRow>
              {request.assignment_note && <DetailRow label="Note">{request.assignment_note}</DetailRow>}
              <DetailRow label="Last update">{timeAgo(request.updated_at)}</DetailRow>
              {request.completed_at && <DetailRow label="Completed">{formatDateTime(request.completed_at)}</DetailRow>}
            </dl>
          </section>

          {showContact && (
            <section className="panel p-5">
              <h2 className="text-lg font-bold">Requester</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={request.requester_name} />
                <div className="min-w-0">
                  <p className="font-semibold">{request.requester_name}</p>
                  {request.requester_department && <p className="truncate text-sm text-muted">{request.requester_department}</p>}
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <a href={`mailto:${request.requester_email}`} className="flex items-center gap-2 text-navy hover:underline">
                  <Mail className="h-4 w-4" aria-hidden /> {request.requester_email}
                </a>
                {request.requester_phone && (
                  <a href={`tel:${request.requester_phone}`} className="flex items-center gap-2 text-navy hover:underline">
                    <Phone className="h-4 w-4" aria-hidden /> {request.requester_phone}
                  </a>
                )}
              </div>
            </section>
          )}

          {user.role === 'ADMIN' && request.assignments.length > 1 && (
            <section className="panel p-5">
              <h2 className="text-lg font-bold">Assignment history</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {request.assignments.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.officer_name}</span>
                    {a.is_active && <span className="text-ok"> (current)</span>}
                    <span className="block text-muted">
                      by {a.assigned_by_name}, {formatDateTime(a.assigned_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
