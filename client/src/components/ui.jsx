/** Small, reusable presentational components. */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, LoaderCircle, Star, X } from 'lucide-react';
import { PRIORITY, STATUS, initials } from '../lib/format';
import { api } from '../lib/api';

const TONES = {
  bronze: 'bg-bronze-soft text-[#6b4e26] border-[#e3cdaa]',
  navy: 'bg-navy-soft text-navy-dark border-[#c9d7e4]',
  ok: 'bg-ok-soft text-ok border-[#bcdcc8]',
  warn: 'bg-warn-soft text-warn border-[#efd2a9]',
  danger: 'bg-danger-soft text-danger border-[#efc1bd]',
  muted: 'bg-[#eef0ec] text-muted border-line',
};

export function Badge({ tone = 'muted', children, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || { label: priority, tone: 'muted' };
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', p.tone === 'danger' ? 'text-danger' : 'text-muted')}>
      <span
        aria-hidden
        className={clsx('h-2 w-2 rounded-full', {
          'bg-danger': p.tone === 'danger',
          'bg-warn': p.tone === 'warn',
          'bg-navy': p.tone === 'navy',
          'bg-line-strong': p.tone === 'muted',
        })}
      />
      {p.label}
    </span>
  );
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-muted', className)}>
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}…</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-faint" aria-hidden />}
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-[#efc1bd] bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </div>
  );
}

/** Label + control + error/hint, wired up for screen readers. */
export function Field({ label, htmlFor, error, hint, children, optional }) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {optional && <span className="ml-1 font-normal text-faint">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-sm text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {children}
        <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? (
      <p className="px-4 py-3 text-sm text-muted">
        {pagination.total} result{pagination.total === 1 ? '' : 's'}
      </p>
    ) : null;
  }
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-muted">
          Page {page} of {totalPages}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={clsx(
        'm-auto w-[calc(100%-2rem)] rounded-lg border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-[#1b2430]/45',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Avatar({ name, size = 'md' }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-navy-soft font-bold text-navy-dark',
        size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs',
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-7 w-7';
  if (!onChange) {
    return (
      <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={clsx(cls, n <= shown ? 'fill-bronze text-bronze' : 'text-line-strong')} aria-hidden />
        ))}
      </span>
    );
  }
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded p-0.5"
        >
          <Star className={clsx(cls, n <= shown ? 'fill-bronze text-bronze' : 'text-line-strong')} />
        </button>
      ))}
    </div>
  );
}

/** Loads a protected image with the access token and shows it. */
export function AuthImage({ id, alt, className }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url;
    let active = true;
    api
      .get(`/attachments/${id}`, { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        if (active) setSrc(url);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (failed) return <div className={clsx('flex items-center justify-center bg-[#eef0ec] text-xs text-muted', className)}>Image unavailable</div>;
  if (!src) return <div className={clsx('animate-pulse bg-[#eef0ec]', className)} />;
  return <img src={src} alt={alt} className={clsx('object-cover', className)} />;
}
