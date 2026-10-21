/** Administrative reports: volumes, trends, categories and officer performance, with export. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, FileText } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { PRIORITY, STATUS, formatHours } from '../../lib/format';
import {
  PageHeader, PageLoader, Stars,
} from '../../components/ui';

const NAVY = '#12395A';
const BRONZE = '#B8925F';
const OK = '#2E7D4F';

function Panel({ title, description, children, className }) {
  return (
    <section className={`panel p-5 ${className || ''}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Breakdown({ entries, total, labels }) {
  return (
    <ul className="space-y-2.5">
      {entries.map(([key, count]) => (
        <li key={key}>
          <div className="flex justify-between text-sm">
            <span>{labels[key]?.label || key}</span>
            <span className="font-semibold">
              {count} <span className="font-normal text-muted">({total ? Math.round((count / total) * 100) : 0}%)</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#eceee9]">
            <div className="h-2 rounded-full bg-navy" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(null);
  const params = { from: range.from || undefined, to: range.to || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => api.get('/reports/summary', { params }).then((r) => r.data.data),
  });

  const exportAs = async (format) => {
    setExporting(format);
    try {
      await downloadFile('/reports/export', { ...params, format }, `campusfix-report.${format}`);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  if (isLoading || !data) return <PageLoader />;
  const { totals } = data;
  const statusOrder = Object.keys(STATUS).filter((k) => data.byStatus[k]);
  const priorityOrder = Object.keys(PRIORITY).filter((k) => data.byPriority[k]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="How requests are flowing through the Works & Maintenance team."
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')} disabled={Boolean(exporting)}>
              <Download className="h-4 w-4" aria-hidden /> {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => exportAs('pdf')} disabled={Boolean(exporting)}>
              <FileText className="h-4 w-4" aria-hidden /> {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </button>
          </>
        )}
      />

      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Submitted from</span>
          <input type="date" className="input" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </label>
        <label className="text-sm">
          <span className="label">to</span>
          <input type="date" className="input" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </label>
        {(range.from || range.to) && (
          <button type="button" className="btn btn-ghost" onClick={() => setRange({ from: '', to: '' })}>
            Show all time
          </button>
        )}
        <p className="ml-auto text-sm text-muted">Exports include the same date range.</p>
      </div>

      <dl className="panel mb-6 grid grid-cols-2 divide-line overflow-hidden lg:grid-cols-5 lg:divide-x">
        {[
          ['Requests', totals.total],
          ['Open', totals.open],
          ['Resolution rate', `${totals.resolution_rate}%`],
          ['Avg. time to complete', formatHours(totals.avg_resolution_hours)],
          ['Satisfaction', totals.avg_rating ? `${totals.avg_rating} / 5` : '—'],
        ].map(([label, value], i) => (
          <div key={label} className={`px-5 py-4 ${i > 1 ? 'border-t border-line lg:border-t-0' : ''} ${i % 2 === 1 ? 'border-l border-line lg:border-l-0' : ''}`}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-[1.75rem] leading-none font-bold [font-stretch:80%]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Submitted vs completed" description="Last six months" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e6e1" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5b6573' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5b6573' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f3f5f1' }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="submitted" name="Submitted" fill={NAVY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill={BRONZE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="By category" description="Requests and how many have been resolved">
          <div className="h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory} layout="vertical" margin={{ left: 10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e6e1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#5b6573' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#1b2430' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f3f5f1' }} />
                <Bar dataKey="count" name="Total" fill={NAVY} radius={[0, 3, 3, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill={OK} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel title="By status">
            <Breakdown entries={statusOrder.map((k) => [k, data.byStatus[k]])} total={totals.total} labels={STATUS} />
          </Panel>
          <Panel title="By priority">
            <Breakdown entries={priorityOrder.map((k) => [k, data.byPriority[k]])} total={totals.total} labels={PRIORITY} />
          </Panel>
        </div>

        <Panel title="Officer performance" description="Current assignments only" className="lg:col-span-2">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-y border-line bg-[#f9faf8] text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Officer</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Assigned</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Open</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Resolved</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Avg. time to complete</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Avg. rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.officers.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-semibold">{o.full_name}</td>
                    <td className="px-5 py-3 text-right">{o.assigned}</td>
                    <td className="px-5 py-3 text-right">{o.open}</td>
                    <td className="px-5 py-3 text-right">{o.resolved}</td>
                    <td className="px-5 py-3 text-right">{formatHours(o.avg_hours)}</td>
                    <td className="px-5 py-3">
                      {o.avg_rating ? (
                        <span className="inline-flex items-center gap-2">
                          <Stars value={Math.round(o.avg_rating)} size="sm" /> {o.avg_rating}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
