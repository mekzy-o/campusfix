/** Signed-in application shell: role-based navigation, notifications and account menu. */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell, ChartColumn, ClipboardList, LayoutDashboard, LogOut, Menu, Plus, ScrollText, Tags, Users, Wrench, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeProvider';
import { api } from '../lib/api';
import { ROLE_LABEL, isRequester } from '../lib/format';
import { Avatar } from './ui';

function navFor(user) {
  if (user.role === 'ADMIN') {
    return [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/requests', label: 'All requests', icon: ClipboardList },
      { to: '/users', label: 'Users', icon: Users },
      { to: '/categories', label: 'Categories', icon: Tags },
      { to: '/reports', label: 'Reports', icon: ChartColumn },
      { to: '/audit', label: 'Audit log', icon: ScrollText },
    ];
  }
  if (user.role === 'OFFICER') {
    return [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/requests', label: 'My jobs', icon: Wrench },
    ];
  }
  return [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/requests', label: 'My requests', icon: ClipboardList, end: true },
    { to: '/requests/new', label: 'Report a problem', icon: Plus },
  ];
}

export function Logo({ inverted = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill={inverted ? '#fff' : '#12395A'} />
        <path d="M20.6 7.2a5.4 5.4 0 0 0-6.9 6.7l-6.6 6.6a2.1 2.1 0 1 0 3 3l6.6-6.6a5.4 5.4 0 0 0 6.7-6.9l-3 3-2.6-.5-.5-2.6z" fill="#C49A5C" />
      </svg>
      <span className={clsx('text-lg font-extrabold [font-stretch:85%]', inverted ? 'text-white' : 'text-ink')}>CampusFix</span>
    </span>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.unread),
    refetchInterval: 60_000,
  });
  const unread = data || 0;
  return (
    <Link to="/notifications" className="btn btn-ghost relative px-2.5" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] leading-[18px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {navFor(user).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium transition-colors',
            isActive ? 'bg-white/12 text-white' : 'text-[#c9d6e3] hover:bg-white/6 hover:text-white',
          )}
        >
          {({ isActive }) => (
            <>
              <Icon className={clsx('h-[18px] w-[18px]', isActive && 'text-bronze')} aria-hidden />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-dark px-3 py-4">
      <div className="mb-6 px-2">
        <Logo inverted />
      </div>
      {nav}
      <div className="mt-auto space-y-3 px-2 pt-6">
        <p className="flex items-center gap-2 text-xs text-[#9fb3c8]">
          <span className={clsx('h-2 w-2 rounded-full', connected ? 'bg-[#5fd08f]' : 'bg-[#9fb3c8]')} aria-hidden />
          {connected ? 'Live updates on' : 'Connecting…'}
        </p>
        <p className="text-xs leading-relaxed text-[#9fb3c8]">Works &amp; Maintenance Department</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <div className="hidden bg-navy-dark lg:block">
        <aside className="sticky top-0 h-screen">{sidebar}</aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-[#1b2430]/50" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw]">
            {sidebar}
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute top-4 right-3 rounded p-1 text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="btn btn-ghost px-2 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="lg:hidden">
            <Logo />
          </span>
          <div className="ml-auto flex items-center gap-1">
            {isRequester(user) && !['/', '/requests', '/requests/new'].includes(location.pathname) && (
              <Link to="/requests/new" className="btn btn-primary btn-sm mr-1 hidden sm:inline-flex">
                <Plus className="h-4 w-4" aria-hidden /> Report a problem
              </Link>
            )}
            <NotificationBell />
            <Link to="/profile" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#eceee9]" aria-label="Your profile">
              <Avatar name={user.full_name} size="sm" />
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-sm font-semibold">{user.full_name}</span>
                <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
              </span>
            </Link>
            <button type="button" onClick={handleLogout} className="btn btn-ghost px-2" aria-label="Sign out" title="Sign out">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

