'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  IndianRupee, TrendingUp, ShoppingCart, BedDouble, Key, LogOut,
  AlertTriangle, Clock, Activity, CreditCard, Banknote, Smartphone,
  Wallet, ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, card: CreditCard, upi: Smartphone, wallet: Wallet,
};

export default function OwnerDashboardPage() {
  const { data: s, isLoading } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => apiFetch('/api/v1/reports/owner-dashboard').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-slate-500 flex items-center gap-2">
          <Activity className="animate-spin" size={16} /> Loading executive dashboard...
        </div>
      </div>
    );
  }

  const totalToday = Number(s?.totalRevenueToday || 0);
  const posToday = Number(s?.posRevenueToday || 0);
  const hotelToday = Number(s?.hotelRevenueToday || 0);
  const posShare = totalToday > 0 ? Math.round((posToday / totalToday) * 100) : 0;
  const hotelShare = totalToday > 0 ? 100 - posShare : 0;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8 space-y-6 bg-slate-950 text-slate-200">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">{dayjs().format('dddd, D MMMM YYYY')} · Property-wide overview</p>
        </div>
      </div>

      {/* ── Total Revenue Hero Card ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-600/20 via-amber-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-amber-300/80 uppercase tracking-wider">Today's Total Revenue</div>
            <div className="text-4xl lg:text-5xl font-extrabold text-white mt-2">
              ₹{totalToday.toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-slate-400 mt-2">{s?.totalBillsToday || 0} bills generated across all departments</div>
          </div>
          <div className="flex gap-4">
            {/* POS share */}
            <div className="bg-slate-900/60 backdrop-blur border border-slate-700 rounded-xl p-4 min-w-[130px]">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <ShoppingCart size={12} /> Restaurant
              </div>
              <div className="text-xl font-bold text-blue-400">₹{posToday.toLocaleString('en-IN')}</div>
              <div className="text-xs text-slate-500 mt-1">{posShare}% of total · {s?.posBillsToday || 0} bills</div>
            </div>
            {/* Hotel share */}
            <div className="bg-slate-900/60 backdrop-blur border border-slate-700 rounded-xl p-4 min-w-[130px]">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <BedDouble size={12} /> Hotel
              </div>
              <div className="text-xl font-bold text-emerald-400">₹{hotelToday.toLocaleString('en-IN')}</div>
              <div className="text-xs text-slate-500 mt-1">{hotelShare}% of total · {s?.hotelBillsToday || 0} bills</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stat Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: '7-Day Revenue', value: `₹${Number(s?.totalRevenueWeek || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Active Orders', value: s?.pendingOrders || 0, icon: Clock, color: 'text-blue-400' },
          { label: 'Occupancy', value: `${s?.occupancyRate || 0}%`, icon: BedDouble, color: 'text-purple-400' },
          { label: 'Check-ins Today', value: s?.todayCheckins || 0, icon: Key, color: 'text-emerald-400' },
          { label: 'Low Stock Alerts', value: s?.lowStockAlerts || 0, icon: AlertTriangle, color: s?.lowStockAlerts > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <div className={cn('text-xl font-bold', color === 'text-red-400' && s?.lowStockAlerts > 0 ? 'text-red-400' : 'text-white')}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── 7-Day Revenue Chart (Stacked POS + Hotel) ──────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-300">7-Day Revenue Breakdown</h2>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s?.weeklyChart || []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#f8fafc' }}
                  formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'pos' ? 'Restaurant' : 'Hotel']}
                />
                <Legend
                  formatter={(value) => value === 'pos' ? 'Restaurant' : 'Hotel'}
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                />
                <Bar dataKey="pos" stackId="rev" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="hotel" stackId="rev" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Payment Collection Breakdown ──────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-300">Today's Collections</h2>
            <IndianRupee size={16} className="text-amber-400" />
          </div>

          {(!s?.paymentBreakdown || s.paymentBreakdown.length === 0) ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-600">No payments recorded today</div>
          ) : (
            <div className="space-y-3 flex-1">
              {s.paymentBreakdown.map((p: any) => {
                const Icon = PAYMENT_ICONS[p.method] || Wallet;
                const pct = totalToday > 0 ? Math.round((p.total / totalToday) * 100) : 0;
                return (
                  <div key={p.method}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Icon size={14} className="text-slate-500" />
                        <span className="capitalize">{p.method}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">₹{Number(p.total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-500">Total Collected</div>
            <div className="text-2xl font-bold text-white">
              ₹{s?.paymentBreakdown?.reduce((a: number, p: any) => a + Number(p.total), 0)?.toLocaleString('en-IN') || '0'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Links ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/dashboard', label: 'Restaurant Dashboard', desc: 'Shifts, orders, hourly sales', color: 'border-blue-500/30 hover:border-blue-500/60' },
          { href: '/hotel/dashboard', label: 'Hotel Dashboard', desc: 'ADR, occupancy, revenue', color: 'border-emerald-500/30 hover:border-emerald-500/60' },
          { href: '/billing', label: 'POS Bills', desc: 'Restaurant billing history', color: 'border-amber-500/30 hover:border-amber-500/60' },
          { href: '/hotel/billing', label: 'Hotel Bills', desc: 'Hotel billing history', color: 'border-purple-500/30 hover:border-purple-500/60' },
        ].map(({ href, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className={cn('bg-slate-900 border rounded-xl p-4 flex items-center justify-between group transition-all', color)}
          >
            <div>
              <div className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
            </div>
            <ArrowRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
