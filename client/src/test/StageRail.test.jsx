import { render, screen } from '@testing-library/react';
import StageRail, { railState } from '../components/StageRail';

describe('railState', () => {
  it('maps each status to its stage', () => {
    expect(railState('PENDING').index).toBe(0);
    expect(railState('ASSIGNED').index).toBe(1);
    expect(railState('IN_PROGRESS').index).toBe(2);
    expect(railState('COMPLETED').index).toBe(3);
    expect(railState('CLOSED').index).toBe(4);
  });

  it('treats On hold as a paused In-progress stage', () => {
    expect(railState('ON_HOLD')).toMatchObject({ index: 2, onHold: true, stopped: null });
  });

  it('stops the rail where a request was rejected or cancelled', () => {
    const logs = [
      { to_status: 'PENDING', from_status: null },
      { to_status: 'ASSIGNED', from_status: 'PENDING' },
      { to_status: 'CANCELLED', from_status: 'ASSIGNED' },
    ];
    expect(railState('CANCELLED', logs)).toMatchObject({ index: 1, stopped: 'CANCELLED' });
    expect(railState('REJECTED', [])).toMatchObject({ index: 0, stopped: 'REJECTED' });
  });
});

describe('<StageRail />', () => {
  it('marks the current stage for screen readers', () => {
    render(<StageRail status="IN_PROGRESS" logs={[]} />);
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(current).toHaveTextContent('In progress');
  });

  it('shows "On hold" on the paused stage', () => {
    render(<StageRail status="ON_HOLD" logs={[]} />);
    expect(screen.getByText('On hold')).toBeInTheDocument();
  });

  it('shows "Rejected" when the request was rejected', () => {
    render(<StageRail status="REJECTED" logs={[{ to_status: 'REJECTED', from_status: 'PENDING' }]} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});
