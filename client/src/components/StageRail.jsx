/**
 * The stage rail: where a job is in its life-cycle.
 * Submitted → Assigned → In progress → Completed → Closed.
 * "On hold" pauses on the In-progress stage; "Rejected" and "Cancelled"
 * stop the rail where the request ended.
 */
import clsx from 'clsx';
import { Check, Pause, X } from 'lucide-react';
import { formatDateTime } from '../lib/format';

export const STAGES = [
  { key: 'PENDING', label: 'Submitted' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CLOSED', label: 'Closed' },
];

const STAGE_INDEX = {
  PENDING: 0, ASSIGNED: 1, IN_PROGRESS: 2, ON_HOLD: 2, COMPLETED: 3, CLOSED: 4,
};

/** Works out the current stage index and whether the rail stopped early. */
export function railState(status, logs = []) {
  if (status === 'REJECTED' || status === 'CANCELLED') {
    const before = [...logs].reverse().find((l) => l.to_status === status)?.from_status || 'PENDING';
    return { index: STAGE_INDEX[before] ?? 0, stopped: status };
  }
  return { index: STAGE_INDEX[status] ?? 0, stopped: null, onHold: status === 'ON_HOLD' };
}

/** Compact five-segment version used in lists. */
export function MiniRail({ status, onDark = false }) {
  const { index, stopped } = railState(status);
  return (
    <span className="inline-flex gap-0.5" aria-hidden title={status}>
      {STAGES.map((s, i) => (
        <span
          key={s.key}
          className={clsx(
            'h-1.5 w-3.5 rounded-full',
            stopped && i > index && 'bg-[#eceee9]',
            stopped && i <= index && 'bg-line-strong',
            !stopped && i < index && (onDark ? 'bg-[#8fa9c2]' : 'bg-navy'),
            !stopped && i === index && (status === 'CLOSED' ? (onDark ? 'bg-[#8fa9c2]' : 'bg-navy') : 'bg-bronze'),
            !stopped && i > index && (onDark ? 'bg-white/15' : 'bg-[#e3e6e1]'),
          )}
        />
      ))}
    </span>
  );
}

/** Full rail with labels and the time each stage was reached. */
export default function StageRail({ status, logs = [] }) {
  const { index, stopped, onHold } = railState(status, logs);
  const reachedAt = (key) => {
    const hit = [...logs].reverse().find((l) => l.to_status === key);
    return hit ? hit.created_at : null;
  };

  return (
    <div className="panel px-4 py-4 sm:px-6">
      <ol className="grid grid-cols-5 gap-1" aria-label="Request progress">
        {STAGES.map((stage, i) => {
          const done = i < index || (i === index && status === 'CLOSED');
          const current = i === index && !done;
          const at = i <= index ? reachedAt(stage.key) : null;
          return (
            <li key={stage.key} className="relative flex flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={clsx('absolute top-3.5 h-0.5', i <= index && !stopped ? 'bg-navy' : 'bg-line')}
                  style={{ left: 'calc(-50% + 16px)', right: 'calc(50% + 16px)' }}
                />
              )}
              <span
                className={clsx(
                  'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold',
                  done && 'border-navy bg-navy text-white',
                  current && !stopped && 'border-[#9c7743] bg-bronze text-ink',
                  current && stopped && 'border-danger bg-danger text-white',
                  !done && !current && 'border-line-strong bg-surface text-faint',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : current && stopped ? <X className="h-4 w-4" /> : current && onHold ? <Pause className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={clsx('mt-2 text-[13px] leading-tight font-semibold', !done && !current && 'text-faint')}>
                {current && onHold ? 'On hold' : current && stopped ? (stopped === 'REJECTED' ? 'Rejected' : 'Cancelled') : stage.label}
              </span>
              {at && <span className="mt-0.5 hidden text-xs text-muted sm:block">{formatDateTime(at)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
