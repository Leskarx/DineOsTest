'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, ShoppingCart, Monitor, Layout, BookOpen, Package,
  Receipt, Clock, BarChart3, Users, Building2, Settings, LogOut,
  Wifi, WifiOff, Shield, Hotel, CalendarDays, SprayCan, BedDouble,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useSubscriptionWall } from '@/hooks/useSubscriptionWall';
import { SubscriptionWall } from '@/components/ui/SubscriptionWall';
import { BranchSwitcher } from '@/components/BranchSwitcher';

interface NavItem { href: string; label: string; icon: React.ElementType; exact?: boolean; roles?: string[] }
interface NavSection { section: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { href: '/executive', label: 'Executive Dashboard', icon: LayoutDashboard, exact: true, roles: ['owner', 'manager'] },
    ],
  },
  {
    section: 'Restaurant',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true, roles: ['owner', 'manager'] },
      { href: '/cashier', label: 'Home', icon: LayoutDashboard, exact: true, roles: ['cashier'] },
      { href: '/waiter', label: 'Home', icon: LayoutDashboard, exact: true, roles: ['waiter'] },
      { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['owner', 'manager', 'cashier', 'waiter'] },
      { href: '/kds', label: 'Kitchen Display', icon: Monitor, roles: ['owner', 'manager', 'kitchen'] },
      { href: '/tables', label: 'Tables', icon: Layout, roles: ['owner', 'manager', 'cashier', 'waiter'] },
      { href: '/menu', label: 'Menu', icon: BookOpen, roles: ['owner', 'manager'] },
      { href: '/inventory', label: 'Inventory', icon: Package, roles: ['owner', 'manager', 'inventory'] },
      { href: '/billing', label: 'Bills', icon: Receipt, roles: ['owner', 'manager', 'cashier'] },
      { href: '/shifts', label: 'Shifts', icon: Clock, roles: ['owner', 'manager'] },
      { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'manager'] },
    ],
  },
  {
    section: 'Hotel',
    items: [
      { href: '/hotel/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['owner', 'manager'] },
      { href: '/hotel', label: 'Front Desk', icon: Hotel, exact: true, roles: ['owner', 'manager', 'cashier', 'receptionist'] },
      { href: '/hotel/reservations', label: 'Reservations', icon: CalendarDays, roles: ['owner', 'manager', 'receptionist'] },
      {
        href: '/hotel/rooms',
        label: 'Rooms',
        icon: BedDouble,
        roles: ['owner', 'manager']
      },
      { href: '/hotel/housekeeping', label: 'Housekeeping', icon: SprayCan, roles: ['owner', 'manager', 'housekeeping', 'receptionist'] },
    
      { href: '/hotel/billing', label: 'Billing', icon: Receipt, roles: ['owner', 'manager', 'cashier'] },
    ],
  },
  {
    section: 'Admin',
    items: [
      { href: '/employees', label: 'Employees', icon: Users, roles: ['owner', 'manager'] },
      { href: '/branches', label: 'Branches', icon: Building2, roles: ['owner'] },
      { href: '/audit', label: 'Audit Log', icon: Shield, roles: ['owner'] },
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'] },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout, branchId } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const isOnline = useOnlineStatus();
  const { isBlocked, plan, daysLeft } = useSubscriptionWall();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) return null;

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

        <div className="pt-3">
          <BranchSwitcher />
        </div>

        <nav className="flex-1 p-2 overflow-y-auto scrollbar-thin">
          {navSections.map(({ section, items }) => {
            // Hide branch-specific sections when in Global Mode (branchId is null)
            if (!branchId && (section === 'Restaurant' || section === 'Hotel')) {
              return null;
            }

            const allowedItems = items.filter(
              (item) => !item.roles || (user?.role && item.roles.includes(user.role))
            );

            if (allowedItems.length === 0) return null;

            return (
              <div key={section} className="mb-3">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 py-1.5">
                  {section}
                </div>
                <div className="space-y-0.5">
                  {allowedItems.map(({ href, label, icon: Icon, exact }) => {
                    const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
                    const displayLabel = href === '/executive' 
                      ? (user?.role === 'owner' ? 'Owner Dashboard' : 'Branch Summary')
                      : label;
                    
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn('sidebar-link', isActive && 'sidebar-link-active')}
                      >
                        <Icon size={16} />
                        <span>{displayLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
