/** Routes and access guards. */
import { Suspense, lazy } from 'react';
import {
  Link, Navigate, Outlet, createBrowserRouter, useLocation,
} from 'react-router';
import { useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeProvider';
import Layout from './components/Layout';
import { EmptyState, PageLoader } from './components/ui';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import RequestsPage from './pages/RequestsPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestDetailPage from './pages/RequestDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/admin/UsersPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import AuditLogPage from './pages/admin/AuditLogPage';

// The charts library is large, so the reports page is loaded only when opened.
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));

/** Only signed-in users (optionally limited to some roles) may pass. */
export function RequireAuth({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return <Outlet />;
}

/** Signed-in users are sent away from the login and registration pages. */
function GuestOnly() {
  const { user, status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

function Forbidden() {
  return (
    <EmptyState title="You don't have access to this page" action={<Link to="/" className="btn btn-primary">Go to overview</Link>}>
      This area is only available to other roles. If you think this is wrong, contact the administrator.
    </EmptyState>
  );
}

function NotFound() {
  return (
    <EmptyState title="Page not found" action={<Link to="/" className="btn btn-primary">Go to overview</Link>}>
      The page you were looking for doesn&rsquo;t exist or has moved.
    </EmptyState>
  );
}

function SignedInShell() {
  return (
    <RealtimeProvider>
      <Layout />
    </RealtimeProvider>
  );
}

export const routes = [
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <SignedInShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'requests', element: <RequestsPage /> },
          {
            element: <RequireAuth roles={['STUDENT', 'STAFF']} />,
            children: [{ path: 'requests/new', element: <NewRequestPage /> }],
          },
          { path: 'requests/:id', element: <RequestDetailPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            element: <RequireAuth roles={['ADMIN']} />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'categories', element: <CategoriesPage /> },
              { path: 'reports', element: <Suspense fallback={<PageLoader />}><ReportsPage /></Suspense> },
              { path: 'audit', element: <AuditLogPage /> },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
