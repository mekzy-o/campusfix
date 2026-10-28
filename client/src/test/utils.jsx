/** Test helpers: render a component inside the providers it needs. */
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

export function renderWithProviders(ui, { route = '/test', path = '/test' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="/login" element={<p>Login screen</p>} />
          <Route path="/requests/:id" element={<p>Request screen</p>} />
          <Route path="/" element={<p>Home screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const users = {
  student: { id: 'u-student', full_name: 'Emeka Nwosu', role: 'STUDENT', email: 'student@campusfix.app' },
  officer: { id: 'u-officer', full_name: 'Ibrahim Musa', role: 'OFFICER', email: 'ibrahim.musa@campusfix.app' },
  admin: { id: 'u-admin', full_name: 'Adaeze Okonkwo', role: 'ADMIN', email: 'admin@campusfix.app' },
};

export const sampleRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: 'SR-2026-00042',
  title: 'Leaking pipe under the bathroom sink',
  description: 'Water has been leaking for two days.',
  location: 'Hostel B (Female)',
  room: 'Room 214',
  priority: 'HIGH',
  status: 'PENDING',
  category_id: 2,
  category_name: 'Plumbing & Water',
  requester_id: 'u-student',
  requester_name: 'Emeka Nwosu',
  officer_id: null,
  officer_name: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Builds an Axios-like error carrying the API's error body. */
export function apiError(message, details) {
  const error = new Error(message);
  error.response = { data: { error: { message, ...(details ? { details } : {}) } } };
  return error;
}
