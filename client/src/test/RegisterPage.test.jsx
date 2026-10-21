import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, renderWithProviders, users } from './utils';
import RegisterPage from '../pages/auth/RegisterPage';

// A hand-rolled stand-in for the auth context: records calls and runs the
// behaviour each test sets in `impl`.
let impl = async () => {};
const register = Object.assign((...args) => { register.calls.push(args); return impl(...args); }, { calls: [] });
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ register }) }));

beforeEach(() => {
  register.calls = [];
  impl = async () => {};
});

async function fill(user, overrides = {}) {
  const values = {
    'Full name': 'Chioma Okeke',
    'Email address': 'chioma@example.com',
    Password: 'Secret123',
    'Confirm password': 'Secret123',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    // eslint-disable-next-line no-await-in-loop
    if (value) await user.type(screen.getByLabelText(label), value);
  }
}

describe('<RegisterPage />', () => {
  it('requires matching passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/r', path: '/r' });
    await fill(user, { 'Confirm password': 'Different1' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(register.calls).toHaveLength(0);
  });

  it('enforces the password policy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/r', path: '/r' });
    await fill(user, { Password: 'onlyletters', 'Confirm password': 'onlyletters' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Include at least one number')).toBeInTheDocument();
  });

  it('changes the ID label for staff', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/r', path: '/r' });
    expect(screen.getByLabelText(/Matric number/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Staff member'));
    expect(screen.getByLabelText(/Staff number/)).toBeInTheDocument();
  });

  it('submits valid details without the confirmation field', async () => {
    impl = async () => users.student;
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/r', path: '/r' });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(register.calls).toHaveLength(1));
    const payload = register.calls[0][0];
    expect(payload).toMatchObject({ fullName: 'Chioma Okeke', email: 'chioma@example.com', role: 'STUDENT' });
    expect(payload).not.toHaveProperty('confirmPassword');
  });

  it('shows field errors returned by the API', async () => {
    impl = async () => {
      throw apiError('An account with this email already exists', [{ field: 'email', message: 'Email already used' }]);
    };
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: '/r', path: '/r' });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByText('Email already used')).toBeInTheDocument();
  });
});
