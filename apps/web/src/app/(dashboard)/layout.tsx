'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, ShoppingCart, Monitor, Layout, BookOpen, Package,
  Receipt, Clock, BarChart3, Users, Building2, Settings, LogOut,
  Wifi, WifiOff, Shield, Hotel, CalendarDays, SprayCan,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useSubscriptionWall } from '@/hooks/useSubscriptionWall';
import { SubscriptionWall } from '@/components/ui/SubscriptionWall';

interface NavItem { href: string; label: string; icon: React.ElementType; exact?: boolean }
interface NavSection { section: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    section: 'Restaurant',
    items: [
      { href: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard, exact: true },
      { href: '/pos',       label: 'POS',            icon: ShoppingCart },
      { href: '/kds',       label: 'Kitchen Display', icon: Monitor },
      { href: '/tables',    label: 'Tables',          icon: Layout },
      { href: '/menu',      label: 'Menu',            icon: BookOpen },
      { href: '/inventory', label: 'Inventory',       icon: Package },
      { href: '/billing',   label: 'Bills',           icon: Receipt },
      { href: '/shifts',    label: 'Shifts',          icon: Clock },
      { href: '/reports',   label: 'Reports',         icon: BarChart3 },
    ],
  },
  {
    section: 'Hotel',
    items: [
      { href: '/hotel',               label: 'Front Desk',    icon: Hotel },
      { href: '/hotel/reservations',  label: 'Reservations',  icon: CalendarDays },
      { href: '/hotel/housekeeping',  label: 'Housekeeping',  icon: SprayCan },
    ],
  },
  {
    section: 'Admin',
    items: [
      { href: '/employees', label: 'Employees', icon: Users },
      { href: '/branches',  label: 'Branches',  icon: Building2 },
      { href: '/audit',     label: 'Audit Log', icon: Shield },
      { href: '/settings',  label: 'Settings',  icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();
  const isOnline = useOnlineStatus();
  const { isBlocked, plan, daysLeft } = useSubscriptionWall();

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  // Onboarding wizard uses its own full-screen layout — skip the sidebar
  if (pathname === '/onboarding') {
    return (
      <ErrorBoundary section="Page">
        {children}
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-slate-900">D</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">Dine&Stay OS</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto scrollbar-thin">
          {navSections.map(({ section, items }) => (
            <div key={section} className="mb-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 py-1.5">
                {section}
              </div>
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon, exact }) => {
                  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn('sidebar-link', isActive && 'sidebar-link-active')}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className={cn('flex items-center gap-2 text-xs px-2 py-1 rounded', isOnline ? 'text-emerald-400' : 'text-amber-400')}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{isOnline ? 'Online' : 'Offline — syncing queued'}</span>
          </div>
          <button onClick={() => { logout(); router.replace('/login'); }} className="sidebar-link w-full text-red-400 hover:text-red-300">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto scrollbar-thin relative">
        {isBlocked && <SubscriptionWall plan={plan} daysLeft={daysLeft} />}
        <ErrorBoundary section="Page">
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
