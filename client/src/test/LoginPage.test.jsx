import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, renderWithProviders, users } from './utils';
import LoginPage from '../pages/auth/LoginPage';

// A hand-rolled stand-in for the auth context: records calls and runs the
// behaviour each test sets in `impl`.
let impl = async () => {};
const login = Object.assign((...args) => { login.calls.push(args); return impl(...args); }, { calls: [] });
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login }) }));

beforeEach(() => {
  login.calls = [];
  impl = async () => {};
});

describe('<LoginPage />', () => {
  it('shows validation messages and does not call the API when the form is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(login.calls).toHaveLength(0);
  });

  it('rejects an invalid email address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'something');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('signs in and goes to the overview', async () => {
    impl = async () => users.student;
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    await user.type(screen.getByLabelText('Email address'), 'student@campusfix.app');
    await user.type(screen.getByLabelText('Password'), 'CampusFix@2026');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(login.calls[0]).toEqual([{ email: 'student@campusfix.app', password: 'CampusFix@2026' }]));
    expect(await screen.findByText('Home screen')).toBeInTheDocument();
  });

  it('shows the server error message when sign-in fails', async () => {
    impl = async () => { throw apiError('Invalid email or password'); };
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    await user.type(screen.getByLabelText('Email address'), 'student@campusfix.app');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('fills the form from a demo account button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    await user.click(screen.getByRole('button', { name: 'Administrator' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('admin@campusfix.app');
    expect(screen.getByLabelText('Password')).toHaveValue('CampusFix@2026');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login-test', path: '/login-test' });
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
