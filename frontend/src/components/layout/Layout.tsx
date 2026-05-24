import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import apiClient from '../../services/api';
import { getSocket, disconnectSocket } from '../../services/socketService';

/* ── Icons ──────────────────────────────────────────────────────────── */
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function JobsIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function AppsIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function InterviewIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function SourcingIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function HRIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function OfferIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function ProctoringIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function PipelineIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-4 h-4', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={clsx('w-5 h-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

/* ── Notification helpers ────────────────────────────────────────────── */

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function notificationUrl(n: any): string {
  const d = n.data ?? {};
  if (d.interviewId) return `/interviews/${d.interviewId}`;
  if (d.applicationId) return `/applications/${d.applicationId}`;
  if (d.offerId) return `/offers`;
  return '/dashboard';
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-amber-500',
  medium: 'bg-blue-400',
  low:    'bg-neutral-300',
};

/* ── NotificationBell component ─────────────────────────────────────── */

function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const panelRef                = useRef<HTMLDivElement>(null);
  const queryClient             = useQueryClient();
  const navigate                = useNavigate();
  const user                    = useAuthStore((s) => s.user);

  // ── Fetch unread notifications (polling fallback every 30 s) ────────
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get('/notifications?limit=20');
      // sendSuccess wraps in { success, data, message }
      return (res.data as any)?.data ?? res.data;
    },
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const notifications: any[] = data?.notifications ?? [];
  const unreadCount: number  = data?.unreadCount ?? 0;

  // ── Real-time: socket 'new-notification' → invalidate cache ─────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('new-notification', handler);
    return () => { socket.off('new-notification', handler); };
  }, [user, queryClient]);

  // ── Click-outside to close ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* non-critical */ }
  };

  const markAllRead = async () => {
    try {
      await apiClient.put('/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* non-critical */ }
  };

  const handleClick = async (n: any) => {
    setOpen(false);
    if (!n.read) await markRead(n._id);
    navigate(notificationUrl(n));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <BellIcon className="text-neutral-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-mono leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <BellIcon className="w-8 h-8 text-neutral-200" />
                <p className="text-sm text-neutral-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    'w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors flex items-start gap-3',
                    !n.read && 'bg-primary-50/40'
                  )}
                >
                  {/* Priority dot */}
                  <span className={clsx(
                    'mt-1.5 w-2 h-2 rounded-full shrink-0',
                    PRIORITY_DOT[n.priority] ?? 'bg-neutral-300'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm leading-snug', !n.read ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-neutral-400 mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-neutral-100 px-4 py-2.5">
              <button
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                className="w-full text-center text-xs text-primary-600 hover:text-primary-800 font-medium"
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Nav item type ────────────────────────────────────────────────── */
interface NavItem {
  name:  string;
  href:  string;
  Icon:  React.ComponentType<{ className?: string }>;
  group?: string;
}

/* ── Navigation configs ────────────────────────────────────────────── */
const candidateNav: NavItem[] = [
  { name: 'Dashboard',       href: '/dashboard',      Icon: DashboardIcon, group: 'main' },
  { name: 'Browse Jobs',     href: '/candidate/jobs', Icon: JobsIcon,      group: 'main' },
  { name: 'My Applications', href: '/applications',   Icon: AppsIcon,      group: 'main' },
  { name: 'Interviews',      href: '/interviews',     Icon: InterviewIcon, group: 'main' },
  { name: 'Profile',         href: '/profile',        Icon: ProfileIcon,   group: 'account' },
];

const superAdminNav: NavItem[] = [
  { name: 'Super Admin', href: '/superadmin', Icon: AdminIcon, group: 'main' },
  { name: 'Profile',     href: '/profile',    Icon: ProfileIcon, group: 'account' },
];

const interviewerNav: NavItem[] = [
  { name: 'Dashboard',  href: '/dashboard',   Icon: DashboardIcon, group: 'main' },
  { name: 'Interviews', href: '/interviews',  Icon: InterviewIcon, group: 'main' },
  { name: 'Pipeline',   href: '/pipeline',    Icon: PipelineIcon,  group: 'main' },
  { name: 'Profile',    href: '/profile',     Icon: ProfileIcon,   group: 'account' },
];

const companyAdminNav: NavItem[] = [
  { name: 'Admin Portal',  href: '/admin',              Icon: AdminIcon,     group: 'admin' },
  { name: 'HR Management', href: '/admin/hr-management',Icon: HRIcon,        group: 'admin' },
  { name: 'Jobs',          href: '/jobs',               Icon: JobsIcon,      group: 'main' },
  { name: 'Applications',  href: '/applications',       Icon: AppsIcon,      group: 'main' },
  { name: 'Pipeline',      href: '/pipeline',           Icon: PipelineIcon,  group: 'main' },
  { name: 'Interviews',    href: '/interviews',         Icon: InterviewIcon, group: 'main' },
  { name: 'Analytics',     href: '/analytics',          Icon: AnalyticsIcon, group: 'main' },
  { name: 'Proctoring',    href: '/proctoring/monitor', Icon: ProctoringIcon,group: 'tools' },
  { name: 'Settings',      href: '/settings',           Icon: AdminIcon,     group: 'tools' },
  { name: 'Profile',       href: '/profile',            Icon: ProfileIcon,   group: 'account' },
];

const defaultNav: NavItem[] = [
  { name: 'Dashboard',    href: '/dashboard',   Icon: DashboardIcon,  group: 'main' },
  { name: 'Jobs',         href: '/jobs',        Icon: JobsIcon,       group: 'main' },
  { name: 'Applications', href: '/applications',Icon: AppsIcon,       group: 'main' },
  { name: 'Pipeline',     href: '/pipeline',    Icon: PipelineIcon,   group: 'main' },
  { name: 'Interviews',   href: '/interviews',  Icon: InterviewIcon,  group: 'main' },
  { name: 'Offers',       href: '/offers',      Icon: OfferIcon,      group: 'main' },
  { name: 'Analytics',    href: '/analytics',   Icon: AnalyticsIcon,  group: 'main' },
  { name: 'Questions',    href: '/questions',   Icon: QuestionIcon,   group: 'tools' },
  { name: 'Sourcing',     href: '/sourcing',    Icon: SourcingIcon,   group: 'tools' },
  { name: 'Settings',     href: '/settings',    Icon: AdminIcon,      group: 'tools' },
  { name: 'Profile',      href: '/profile',     Icon: ProfileIcon,    group: 'account' },
];

/* ── Sidebar nav item component ─────────────────────────────────────── */
function SidebarNavItem({
  item, isActive, collapsed,
}: { item: NavItem; isActive: boolean; collapsed: boolean }) {
  return (
    <Link
      to={item.href}
      title={collapsed ? item.name : undefined}
      className={clsx(
        'nav-item group relative',
        isActive && 'active',
        collapsed && 'justify-center px-0 py-2.5 w-10 mx-auto',
      )}
    >
      <item.Icon className={clsx(
        'shrink-0 nav-icon transition-colors',
        isActive ? 'text-primary-600' : 'text-neutral-400 group-hover:text-neutral-700',
      )} />
      {!collapsed && <span className="truncate">{item.name}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 z-50 px-2 py-1 text-xs font-medium text-white bg-neutral-800 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          {item.name}
        </span>
      )}
    </Link>
  );
}

/* ── Main Layout ─────────────────────────────────────────────────────── */
export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch company branding
  const { data: companyData } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => apiClient.get('/companies/settings').then(r => r.data.data),
    enabled: !!user && user.role !== 'candidate',
    staleTime: 5 * 60 * 1000,
  });

  // Apply branding CSS variable
  useEffect(() => {
    if (companyData?.branding?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary-600', companyData.branding.primaryColor);
    }
    return () => { document.documentElement.style.removeProperty('--color-primary-600'); };
  }, [companyData?.branding?.primaryColor]);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const navigation =
    user?.role === 'candidate'              ? candidateNav  :
    user?.role === 'admin' && !user?.companyId ? superAdminNav :
    user?.role === 'admin'                  ? companyAdminNav :
    user?.role === 'interviewer'            ? interviewerNav :
                                              defaultNav;

  const groups = Array.from(new Set(navigation.map((n) => n.group)));

  const groupLabel: Record<string, string> = {
    main:    'Main',
    admin:   'Administration',
    tools:   'Tools',
    account: 'Account',
  };

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className={clsx(
        'flex items-center gap-2.5 px-4 py-4 border-b border-neutral-100',
        collapsed && 'justify-center px-2',
      )}>
        {companyData?.branding?.logoUrl ? (
          <img src={companyData.branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-md shrink-0" />
        ) : (
          <div className="w-8 h-8 bg-primary-600 rounded-md flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        )}
        {!collapsed && (
          <span className="font-semibold text-neutral-900 text-base tracking-tight">
            {companyData?.name || 'RecuirtPro'}
          </span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => {
          const items = navigation.filter((n) => n.group === group);
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 select-none">
                  {groupLabel[group!] ?? group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href))}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={clsx(
        'border-t border-neutral-100 px-3 py-3',
        collapsed && 'flex flex-col items-center gap-2',
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <Avatar
              name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-neutral-500 capitalize truncate">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-md text-neutral-400 hover:text-error-600 hover:bg-error-50 transition-colors"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <>
            <Avatar name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size="sm" />
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-md text-neutral-400 hover:text-error-600 hover:bg-error-50 transition-colors"
            >
              <LogoutIcon />
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* ── Skip link (WCAG 2.4.1) ──────────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-primary-600 focus:rounded-lg focus:ring-2 focus:ring-primary-600 focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col bg-white border-r border-neutral-200 h-screen sticky top-0 transition-all duration-200 shrink-0 z-30',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent}

        {/* Collapse toggle — A11Y-001: aria-label on icon-only button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeftIcon className={clsx('transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-neutral-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-neutral-200 flex flex-col z-50 animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Desktop topbar — notification bell + current user chip */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-white border-b border-neutral-200 px-6 h-14 items-center justify-end gap-2">
          <NotificationBell />
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 ml-1">
            <Avatar name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size="sm" />
            <span className="text-sm text-neutral-700 font-medium">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
        </header>

        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-neutral-200 px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"  /* A11Y-001 */
            className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <MenuIcon />
          </button>
          <span className="font-semibold text-neutral-900">RecuirtPro</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Avatar name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size="sm" />
          </div>
        </header>

        <main id="main-content" className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
