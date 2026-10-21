/**
 * The action panel on a request page. Which buttons appear depends on the
 * signed-in user's role and the request's status — the same rules the API
 * enforces, so users are only offered actions that will succeed.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  Ban, CheckCheck, CirclePlay, Pause, Pencil, RotateCcw, Trash2, UserPlus, Wrench,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { PRIORITY, isRequester } from '../lib/format';
import { validateImages } from '../lib/schemas';
import { useAuth } from '../context/AuthContext';
import ImagePicker from './ImagePicker';
import EditRequestModal from './EditRequestModal';
import {
  Badge, ErrorBox, Field, Modal, Stars,
} from './ui';

function useRequestMutation(request, { onDone } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ url, method = 'patch', body }) => api[method](url, body).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(res.message);
      onDone?.(res);
    },
  });
}

/** Status change dialog with optional comment, rating and photos. */
function StatusDialog({ request, action, onClose }) {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const mutation = useRequestMutation(request, { onDone: onClose });

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (action.commentRequired && !comment.trim()) {
      setError(action.commentRequiredMessage || 'Please add a short explanation.');
      return;
    }
    let body;
    if (files.length) {
      body = new FormData();
      body.append('status', action.to);
      if (comment.trim()) body.append('comment', comment.trim());
      files.forEach((f) => body.append('images', f));
    } else {
      body = { status: action.to, comment: comment.trim() || undefined };
      if (action.withRating) {
        body.rating = rating || undefined;
        body.feedback = comment.trim() || undefined;
      }
    }
    mutation.mutate(
      { url: `/requests/${request.id}/status`, body },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={action.title}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Back
          </button>
          <button type="submit" form="status-form" className={clsx('btn', action.tone === 'danger' ? 'btn-danger' : action.tone === 'ok' ? 'btn-ok' : 'btn-primary')} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : action.confirm}
          </button>
        </>
      )}
    >
      <form id="status-form" onSubmit={submit} className="space-y-4">
        {action.intro && <p className="text-muted">{action.intro}</p>}
        <ErrorBox>{error}</ErrorBox>
        {action.withRating && (
          <div>
            <p className="label">How satisfied are you with the repair?</p>
            <Stars value={rating} onChange={setRating} />
          </div>
        )}
        <Field label={action.commentLabel || 'Comment'} htmlFor="status-comment" optional={!action.commentRequired}>
          <textarea id="status-comment" rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
        </Field>
        {action.withPhotos && (
          <div>
            <p className="label">
              Photo of the finished work <span className="font-normal text-faint">(optional)</span>
            </p>
            <ImagePicker
              id="completion-images"
              files={files}
              label="Add photo"
              error={fileError}
              onChange={(next) => {
                const problem = validateImages(next);
                setFileError(problem || '');
                if (!problem) setFiles(next);
              }}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

function AssignDialog({ request, onClose }) {
  const [officerId, setOfficerId] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState(request.priority);
  const [error, setError] = useState('');
  const mutation = useRequestMutation(request, { onDone: onClose });

  const { data: officers, isLoading } = useQuery({
    queryKey: ['officers', request.category_id],
    queryFn: () => api.get('/users/officers', { params: { categoryId: request.category_id } }).then((r) => r.data.data),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!officerId) {
      setError('Choose an officer to assign.');
      return;
    }
    mutation.mutate(
      {
        url: `/requests/${request.id}/assign`, method: 'post', body: { officerId, note: note.trim() || undefined, priority },
      },
      { onError: (err) => setError(errorMessage(err)) },
    );
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={request.officer_id ? 'Reassign request' : 'Assign to an officer'}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Back
          </button>
          <button type="submit" form="assign-form" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </>
      )}
    >
      <form id="assign-form" onSubmit={submit} className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <fieldset>
          <legend className="label">
            Officers skilled in {request.category_name} are listed first
          </legend>
          {isLoading ? (
            <p className="text-sm text-muted">Loading officers…</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {officers.map((o) => (
                <label
                  key={o.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
                    officerId === o.id ? 'border-navy bg-navy-soft ring-1 ring-navy' : 'border-line-strong hover:border-navy',
                    o.id === request.officer_id && 'opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name="officer"
                    value={o.id}
                    checked={officerId === o.id}
                    disabled={o.id === request.officer_id}
                    onChange={() => setOfficerId(o.id)}
                    className="mt-1 accent-[#12395A]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.full_name}</span>
                      {o.matches_category && <Badge tone="ok">Skill match</Badge>}
                      {o.availability !== 'AVAILABLE' && <Badge tone="warn">{o.availability === 'BUSY' ? 'Busy' : 'Off duty'}</Badge>}
                      {o.id === request.officer_id && <Badge>Current</Badge>}
                    </span>
                    <span className="block text-sm text-muted">
                      {o.specialisation}, {o.open_jobs} open job{o.open_jobs === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Priority" htmlFor="assign-priority">
            <select id="assign-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(PRIORITY).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note for the officer" htmlFor="assign-note" optional>
            <input id="assign-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Take a replacement tap" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ request, onClose }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const mutation = useRequestMutation(request, { onDone: () => navigate('/requests', { replace: true }) });
  return (
    <Modal
      open
      onClose={onClose}
      title="Delete this request?"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ url: `/requests/${request.id}`, method: 'delete' }, { onError: (err) => setError(errorMessage(err)) })}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete request'}
          </button>
        </>
      )}
    >
      <ErrorBox>{error}</ErrorBox>
      <p className="text-muted">
        {request.reference} and its history will be removed permanently. This is recorded in the audit log.
      </p>
    </Modal>
  );
}

const ACTIONS = {
  start: {
    to: 'IN_PROGRESS', label: 'Start work', icon: CirclePlay, title: 'Start work on this job', confirm: 'Start work', commentLabel: 'Note for the requester',
  },
  hold: {
    to: 'ON_HOLD', label: 'Put on hold', icon: Pause, title: 'Put job on hold', confirm: 'Put on hold', commentLabel: 'Why is it on hold?', commentRequired: true, commentRequiredMessage: 'Explain why the job is on hold, e.g. waiting for parts.', style: 'secondary',
  },
  resume: {
    to: 'IN_PROGRESS', label: 'Resume work', icon: CirclePlay, title: 'Resume work', confirm: 'Resume', commentLabel: 'Update',
  },
  complete: {
    to: 'COMPLETED', label: 'Mark as completed', icon: CheckCheck, title: 'Mark job as completed', confirm: 'Mark completed', tone: 'ok', commentLabel: 'What was done?', commentRequired: true, commentRequiredMessage: 'Describe the work done so the requester knows what changed.', withPhotos: true, intro: 'The requester will be asked to confirm the fix.',
  },
  confirm: {
    to: 'CLOSED', label: 'Confirm it is fixed', icon: CheckCheck, title: 'Confirm the repair', confirm: 'Confirm and close', tone: 'ok', commentLabel: 'Feedback', withRating: true, intro: 'Closing the request tells the team the problem is solved.',
  },
  reopen: {
    to: 'IN_PROGRESS', label: 'Still not fixed', icon: RotateCcw, title: 'Reopen the request', confirm: 'Reopen request', commentLabel: 'What is still wrong?', commentRequired: true, commentRequiredMessage: 'Tell the officer what is still wrong.', style: 'secondary',
  },
  cancel: {
    to: 'CANCELLED', label: 'Cancel request', icon: Ban, title: 'Cancel this request', confirm: 'Cancel request', tone: 'danger', commentLabel: 'Reason', style: 'secondary',
  },
  reject: {
    to: 'REJECTED', label: 'Reject', icon: Ban, title: 'Reject request', confirm: 'Reject request', tone: 'danger', commentLabel: 'Reason for rejection', commentRequired: true, commentRequiredMessage: 'Give the requester a reason.', style: 'secondary',
  },
  close: {
    to: 'CLOSED', label: 'Close request', icon: CheckCheck, title: 'Close request', confirm: 'Close request', tone: 'ok', commentLabel: 'Closing note',
  },
  restore: {
    to: 'PENDING', label: 'Move back to pending', icon: RotateCcw, title: 'Restore request', confirm: 'Restore', commentLabel: 'Reason', style: 'secondary',
  },
};

function availableActions(user, status) {
  if (isRequester(user)) {
    return { PENDING: ['edit', 'cancel', 'delete'], COMPLETED: ['confirm', 'reopen'] }[status] || [];
  }
  if (user.role === 'OFFICER') {
    return { ASSIGNED: ['start'], IN_PROGRESS: ['complete', 'hold'], ON_HOLD: ['resume'] }[status] || [];
  }
  return {
    PENDING: ['assign', 'edit', 'reject', 'cancel', 'delete'],
    ASSIGNED: ['assign', 'edit', 'cancel', 'delete'],
    IN_PROGRESS: ['assign', 'edit', 'cancel', 'delete'],
    ON_HOLD: ['assign', 'edit', 'cancel', 'delete'],
    COMPLETED: ['close', 'reopen', 'delete'],
    REJECTED: ['restore', 'delete'],
    CLOSED: ['delete'],
    CANCELLED: ['delete'],
  }[status] || [];
}

export default function RequestActions({ request }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(null);
  const keys = availableActions(user, request.status);

  if (keys.length === 0) {
    return (
      <p className="text-sm text-muted">
        {request.status === 'CLOSED' || request.status === 'CANCELLED'
          ? 'This request is finished. No further action is needed.'
          : user.role === 'OFFICER'
            ? 'Waiting for the requester to confirm the repair.'
            : 'Nothing for you to do right now. You will be notified when it changes.'}
      </p>
    );
  }

  const buttons = keys.map((key) => {
    if (key === 'assign') {
      return { key, label: request.officer_id ? 'Reassign' : 'Assign officer', icon: request.officer_id ? Wrench : UserPlus, primary: !request.officer_id };
    }
    if (key === 'edit') return { key, label: 'Edit details', icon: Pencil, style: 'secondary' };
    if (key === 'delete') return { key, label: 'Delete', icon: Trash2, style: 'ghost-danger' };
    const a = ACTIONS[key];
    if (key === 'reopen' && user.role === 'ADMIN') return { key, label: 'Reopen', icon: a.icon, style: 'secondary' };
    return { key, label: a.label, icon: a.icon, style: a.style };
  });
  const primaryIndex = buttons.findIndex((b) => !b.style);

  return (
    <div className="flex flex-col gap-2">
      {buttons.map((b, i) => {
        const Icon = b.icon;
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => setOpen(b.key)}
            className={clsx(
              'btn w-full justify-start',
              i === primaryIndex ? 'btn-primary' : b.style === 'ghost-danger' ? 'btn-ghost text-danger hover:!text-danger' : 'btn-secondary',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {b.label}
          </button>
        );
      })}

      {open === 'assign' && <AssignDialog request={request} onClose={() => setOpen(null)} />}
      {open === 'edit' && <EditRequestModal request={request} onClose={() => setOpen(null)} />}
      {open === 'delete' && <DeleteDialog request={request} onClose={() => setOpen(null)} />}
      {ACTIONS[open] && <StatusDialog request={request} action={ACTIONS[open]} onClose={() => setOpen(null)} />}
    </div>
  );
}
