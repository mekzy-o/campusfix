import { screen, within } from '@testing-library/react';
import { renderWithProviders, sampleRequest, users } from './utils';
import RequestList from '../components/RequestList';
import { StatusBadge, PriorityBadge, Pagination } from '../components/ui';
import { formatHours, timeAgo, initials } from '../lib/format';

let currentUser = users.admin;
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));

const rows = [
  sampleRequest,
  {
    ...sampleRequest, id: '2', reference: 'SR-2026-00043', title: 'Projector not displaying', status: 'IN_PROGRESS', officer_id: 'o', officer_name: 'Grace Effiong',
  },
];

describe('<RequestList />', () => {
  it('renders one linked row per request with reference, status and location', () => {
    renderWithProviders(<RequestList requests={rows} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', `/requests/${sampleRequest.id}`);
    expect(within(links[0]).getByText('SR-2026-00042')).toBeInTheDocument();
    expect(within(links[0]).getByText('Pending')).toBeInTheDocument();
    expect(within(links[0]).getByText(/Hostel B \(Female\), Room 214/)).toBeInTheDocument();
    expect(within(links[1]).getByText('Grace Effiong')).toBeInTheDocument();
  });

  it('shows who reported it to admins but not to the requester', () => {
    currentUser = users.admin;
    const { unmount } = renderWithProviders(<RequestList requests={rows} />);
    expect(screen.getAllByText('by Emeka Nwosu')).toHaveLength(2);
    unmount();
    currentUser = users.student;
    renderWithProviders(<RequestList requests={rows} />);
    expect(screen.queryByText('by Emeka Nwosu')).not.toBeInTheDocument();
  });
});

describe('badges and pagination', () => {
  it('shows readable status and priority labels', () => {
    renderWithProviders(
      <>
        <StatusBadge status="ON_HOLD" />
        <PriorityBadge priority="URGENT" />
      </>,
    );
    expect(screen.getByText('On hold')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('disables Previous on the first page and reports the range', () => {
    renderWithProviders(<Pagination pagination={{ page: 1, limit: 10, total: 25, totalPages: 3 }} onPage={() => {}} />);
    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });
});

describe('format helpers', () => {
  it('formats durations', () => {
    expect(formatHours(5)).toBe('5 h');
    expect(formatHours(36)).toBe('1.5 days');
    expect(formatHours(null)).toBe('—');
  });
  it('formats relative times', () => {
    expect(timeAgo(new Date())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 3 * 3600 * 1000))).toBe('3 hours ago');
  });
  it('builds initials without titles', () => {
    expect(initials('Dr. Folake Adeniyi')).toBe('FA');
  });
});
