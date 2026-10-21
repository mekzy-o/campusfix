import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { users } from './utils';
import { RequireAuth } from '../App';

let auth = { user: null, status: 'anonymous' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

function renderAt(path, roles) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<RequireAuth roles={roles} />}>
          <Route path="/users" element={<p>Users screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('<RequireAuth /> route guard', () => {
  it('sends anonymous visitors to the sign-in page', () => {
    auth = { user: null, status: 'anonymous' };
    renderAt('/users');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('waits while the session is being restored', () => {
    auth = { user: null, status: 'loading' };
    renderAt('/users');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('blocks users whose role is not allowed', () => {
    auth = { user: users.student, status: 'authenticated' };
    renderAt('/users', ['ADMIN']);
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('lets allowed roles through', () => {
    auth = { user: users.admin, status: 'authenticated' };
    renderAt('/users', ['ADMIN']);
    expect(screen.getByText('Users screen')).toBeInTheDocument();
  });
});
