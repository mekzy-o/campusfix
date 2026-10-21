import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, sampleRequest, users } from './utils';
import RequestActions from '../components/RequestActions';

let currentUser = users.student;
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

const show = (user, status, extra = {}) => {
  currentUser = user;
  return renderWithProviders(<RequestActions request={{ ...sampleRequest, status, ...extra }} />);
};
const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent.trim());

describe('<RequestActions /> offers only the actions the workflow allows', () => {
  it('requester, pending: edit, cancel or delete', () => {
    show(users.student, 'PENDING');
    expect(buttons()).toEqual(['Edit details', 'Cancel request', 'Delete']);
  });

  it('requester, completed: confirm or reopen', () => {
    show(users.student, 'COMPLETED');
    expect(buttons()).toEqual(['Confirm it is fixed', 'Still not fixed']);
  });

  it('requester, in progress: nothing to do', () => {
    show(users.student, 'IN_PROGRESS');
    expect(buttons()).toEqual([]);
    expect(screen.getByText(/You will be notified/)).toBeInTheDocument();
  });

  it('officer, assigned: start work', () => {
    show(users.officer, 'ASSIGNED');
    expect(buttons()).toEqual(['Start work']);
  });

  it('officer, in progress: complete or put on hold', () => {
    show(users.officer, 'IN_PROGRESS');
    expect(buttons()).toEqual(['Mark as completed', 'Put on hold']);
  });

  it('admin, pending: assign is the primary action', () => {
    show(users.admin, 'PENDING');
    expect(buttons()[0]).toBe('Assign officer');
    expect(screen.getByRole('button', { name: 'Assign officer' })).toHaveClass('btn-primary');
    expect(buttons()).toContain('Reject');
  });

  it('admin, already assigned: offers reassignment', () => {
    show(users.admin, 'ASSIGNED', { officer_id: 'u-officer', officer_name: 'Ibrahim Musa' });
    expect(buttons()).toContain('Reassign');
  });

  it('closed requests offer nothing to requesters', () => {
    show(users.student, 'CLOSED');
    expect(screen.getByText(/This request is finished/)).toBeInTheDocument();
  });

  it('putting a job on hold requires a reason', async () => {
    const u = userEvent.setup();
    show(users.officer, 'IN_PROGRESS');
    await u.click(screen.getByRole('button', { name: 'Put on hold' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    await u.click(within(dialog).getByRole('button', { name: 'Put on hold', hidden: true }));
    expect(await screen.findByText(/Explain why the job is on hold/)).toBeInTheDocument();
  });
});
