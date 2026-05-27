'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { TrendingUp, IndianRupee, BedDouble, CalendarDays, Key, LogOut, Activity, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function HotelDashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['hotel-dashboard-summary'],
    queryFn: () => apiFetch('/api/v1/reports/hotel-dashboard').then((r) => r.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-slate-900 dark:text-slate-500 flex items-center gap-2">
          <Activity className="animate-spin" size={16} /> Loading hotel analytics...
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Today's Revenue", value: `₹${Number(summary?.todaySales || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: "Today's Check-ins", value: summary?.todayCheckins || 0, icon: Key, color: 'text-blue-400' },
    { label: "Today's Check-outs", value: summary?.todayCheckouts || 0, icon: LogOut, color: 'text-amber-600 dark:text-amber-400' },
    { label: "Occupancy Rate", value: `${summary?.occupancyRate || 0}%`, icon: BedDouble, color: 'text-purple-400' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-amber-500" /> Hotel Sales Dashboard
          </h1>
          <p className="text-slate-900 dark:text-slate-400 text-sm mt-1">Financial and operational performance overview</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-400">{label}</span>
              <div className={cn("p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50", color)}>
                <Icon size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Sales Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">7-Day Revenue Trend</h2>
            <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.weeklyChart || []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  cursor={{ fill: 'var(--chart-grid-line)' }}
                  contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)' }}
                  itemStyle={{ color: '#fbbf24' }}
                  formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {(summary?.weeklyChart || []).map((_: any, i: number) => (
                    <Cell key={i} fill={i === (summary?.weeklyChart?.length - 1) ? '#f59e0b' : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly summary & ADR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">7-Day Total Revenue</h2>
              <IndianRupee size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-4 text-4xl font-bold text-slate-900 dark:text-white">
              ₹{Number(summary?.weekSales || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-slate-900 dark:text-slate-400 mt-2 flex items-center gap-1.5">
              <CalendarDays size={14} /> Last 7 days
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-slate-500 uppercase tracking-wider mb-1">Avg Daily Rate</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{Number(summary?.adr || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-slate-500 uppercase tracking-wider mb-1">Today's Bills</div>
              <div className="text-xl font-bold text-blue-400">
                {summary?.todayBills || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Status Breakdown */}
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
        <BedDouble size={20} className="text-amber-500" /> Live Room Status
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Available', value: summary?.roomStats?.available || 0, color: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' },
          { label: 'Occupied', value: summary?.roomStats?.occupied || 0, color: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400' },
          { label: 'Reserved', value: summary?.roomStats?.reserved || 0, color: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400' },
          { label: 'Cleaning', value: summary?.roomStats?.cleaning || 0, color: 'border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400' },
          { label: 'Maintenance', value: summary?.roomStats?.maintenance || 0, color: 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn("border rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm", color)}>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <div className="text-sm font-medium uppercase tracking-wider opacity-80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
