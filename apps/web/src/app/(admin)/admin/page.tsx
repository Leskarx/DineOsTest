'use client';
/**
 * Superadmin — Overview
 * Platform-wide KPI stats, charts, activity feed.
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  Building2, Users, CreditCard, ShoppingBag,
  TrendingUp, RefreshCw, Loader2, ArrowRight,
  CheckCircle2, Clock, AlertTriangle, Activity,
  Store,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  tenants: { total: number; active: number };
  subscriptions: { active: number; trial: number; churned: number };
  orders30d: number;
  activeToday: number;
  mrr: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, href, trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
  href?: string;
  trend?: string;
}) {
  const inner = (
    <div className={cn(
      'bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start gap-4 transition-all',
      href && 'hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer group',
    )}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-white tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-2">{sub}</p>}
      </div>
      {href && <ArrowRight size={14} className="text-slate-600 mt-1 flex-shrink-0 group-hover:text-slate-400 transition-colors" />}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

// ─── Activity event row ───────────────────────────────────────────────────────

function ActivityRow({ event }: { event: any }) {
  const isOrder = event.event_type === 'order_created';
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isOrder ? 'bg-violet-500/15' : 'bg-emerald-500/15',
      )}>
        {isOrder
          ? <ShoppingBag size={13} className="text-violet-400" />
          : <Store size={13} className="text-emerald-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 font-medium truncate">{event.tenant_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>
      </div>
      <p className="text-xs text-slate-600 flex-shrink-0 mt-0.5">
        {format(new Date(event.created_at), 'dd MMM, HH:mm')}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/stats').then(r => r.data.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: ordersTrend } = useQuery<any[]>({
    queryKey: ['admin-orders-trend'],
    queryFn: () => api.get('/api/v1/admin/charts/orders').then(r => r.data),
    staleTime: 120_000,
  });

  const { data: signupsTrend } = useQuery<any[]>({
    queryKey: ['admin-signups-trend'],
    queryFn: () => api.get('/api/v1/admin/charts/signups').then(r => r.data),
    staleTime: 120_000,
  });

  const { data: activityData } = useQuery<{ data: any[] }>({
    queryKey: ['admin-activity-feed'],
    queryFn: () => api.get('/api/v1/admin/activity?limit=20').then(r => r.data.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: tenantsData } = useQuery<{ data: any[] }>({
    queryKey: ['admin-top-tenants'],
    queryFn: () => api.get('/api/v1/admin/tenants?limit=5').then(r => r.data.data),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <p className="text-sm">Failed to load platform stats.</p>
        <button onClick={() => refetch()} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const stats: Stats = {
    tenants:       data.tenants       ?? { total: 0, active: 0 },
    subscriptions: data.subscriptions ?? { active: 0, trial: 0, churned: 0 },
    orders30d:     data.orders30d     ?? 0,
    activeToday:   data.activeToday   ?? 0,
    mrr:           data.mrr           ?? 0,
  };

  const pieData = [
    { name: 'Active',  value: stats.subscriptions.active },
    { name: 'Trial',   value: stats.subscriptions.trial },
    { name: 'Churned', value: stats.subscriptions.churned },
  ];

  const activityList: any[] = Array.isArray(activityData) ? activityData : activityData?.data ?? [];
  const tenantList: any[]   = Array.isArray(tenantsData)  ? tenantsData  : tenantsData?.data  ?? [];

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time stats across all tenants</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm transition-colors"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Businesses"
            value={stats.tenants.total}
            sub={`${stats.tenants.active} active right now`}
            icon={Building2}
            color="bg-blue-500/15 text-blue-400"
            iconBg="bg-blue-500/15"
            href="/admin/tenants"
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.subscriptions.active}
            sub={`${stats.subscriptions.trial} currently on trial`}
            icon={CreditCard}
            color="bg-emerald-500/15 text-emerald-400"
            iconBg="bg-emerald-500/15"
            href="/admin/subscriptions"
          />
          <StatCard
            label="Orders (30 days)"
            value={stats.orders30d.toLocaleString('en-IN')}
            sub={`${stats.activeToday} businesses active today`}
            icon={ShoppingBag}
            color="bg-violet-500/15 text-violet-400"
            iconBg="bg-violet-500/15"
          />
          <StatCard
            label="Monthly Revenue"
            value={`₹${Number(stats.mrr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            sub="from bills this month"
            icon={TrendingUp}
            color="bg-amber-500/15 text-amber-400"
            iconBg="bg-amber-500/15"
          />
        </div>

        {/* ── Charts Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Orders area chart — takes 2/3 */}
          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-semibold text-white">Order Volume</p>
                <p className="text-xs text-slate-500 mt-0.5">Daily orders over the last 30 days</p>
              </div>
              <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded-lg">30d</span>
            </div>
            {!ordersTrend || ordersTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No order data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={ordersTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone" dataKey="orders" name="Orders"
                    stroke="#8b5cf6" strokeWidth={2}
                    fill="url(#ordersGrad)"
                    dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Subscription donut — 1/3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold text-white">Subscription Health</p>
              <p className="text-xs text-slate-500 mt-0.5">Current breakdown</p>
            </div>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {[
                { label: 'Active',  count: stats.subscriptions.active,  color: 'bg-emerald-500', text: 'text-emerald-400', icon: CheckCircle2 },
                { label: 'Trial',   count: stats.subscriptions.trial,   color: 'bg-amber-500',   text: 'text-amber-400',   icon: Clock },
                { label: 'Churned', count: stats.subscriptions.churned, color: 'bg-red-500',     text: 'text-red-400',     icon: AlertTriangle },
              ].map(({ label, count, color, text, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums', text)}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Signups bar chart + Activity + Top Tenants ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Signups bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold text-white">New Businesses</p>
              <p className="text-xs text-slate-500 mt-0.5">Daily signups (30 days)</p>
            </div>
            {!signupsTrend || signupsTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No signup data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={signupsTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="signups" name="Signups" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Live Activity
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Updates every 30s</p>
              </div>
              <Link href="/admin/activity" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto max-h-64 space-y-0">
              {activityList.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No recent activity</div>
              ) : (
                activityList.slice(0, 12).map((event, i) => <ActivityRow key={i} event={event} />)
              )}
            </div>
          </div>

          {/* Top Tenants */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Recent Businesses</p>
                <p className="text-xs text-slate-500 mt-0.5">Newest on the platform</p>
              </div>
              <Link href="/admin/tenants" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-3">
              {tenantList.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No tenants yet</div>
              ) : (
                tenantList.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300">
                      {t.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 truncate">{t.email}</p>
                    </div>
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0',
                      t.sub_status === 'active'  ? 'bg-emerald-500/15 text-emerald-400' :
                      t.sub_status === 'trial'   ? 'bg-amber-500/15 text-amber-400' :
                                                   'bg-slate-700 text-slate-400',
                    )}>
                      {t.sub_status ?? 'none'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
