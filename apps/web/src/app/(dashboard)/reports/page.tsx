'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Receipt, Package, FileText,
  Download, Users, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

// ─── CSV download ──────────────────────────────────────────────────────────────
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? '')).join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── GSTR-1 JSON download ──────────────────────────────────────────────────────
// Uses the existing axios `api` instance which handles auth automatically.
// No need to manually read tokens from localStorage.
async function downloadGstr1(from: string, to: string) {
  try {
    const res = await api.get(
      `/api/v1/reports/gstr1-export?from=${from}&to=${to}`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `GSTR1_${from}_${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('GSTR-1 export error:', err);
    alert(err?.response?.data?.message || 'GSTR-1 export failed. Check console for details.');
  }
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

type ReportTab = 'sales' | 'items' | 'payments' | 'gst' | 'shifts' | 'waiters';

const TABS = [
  { id: 'sales',    label: 'Sales',      icon: TrendingUp },
  { id: 'items',    label: 'Top Items',  icon: Package    },
  { id: 'payments', label: 'Payments',   icon: Receipt    },
  { id: 'gst',      label: 'GST Report', icon: FileText   },
  { id: 'shifts',   label: 'Shifts',     icon: Clock      },
  { id: 'waiters',  label: 'Waiters',    icon: Users      },
] as const;

export default function ReportsPage() {
  const [tab,  setTab]  = useState<ReportTab>('sales');
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to,   setTo]   = useState(dayjs().format('YYYY-MM-DD'));
  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: dailySales } = useQuery({
    queryKey: ['report-daily', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/daily-sales?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'sales',
  });

  const { data: itemSales } = useQuery({
    queryKey: ['report-items', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/items?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'items',
  });

  const { data: payments } = useQuery({
    queryKey: ['report-payments', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/payments?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'payments',
  });

  const { data: gstReport } = useQuery({
    queryKey: ['report-gst', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/gst?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'gst',
  });

  const { data: shiftReport } = useQuery({
    queryKey: ['report-shifts', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/shifts?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'shifts',
  });

  const { data: waiterReport } = useQuery({
    queryKey: ['report-waiters', from, to],
    queryFn:  () => apiFetch(`/api/v1/reports/waiters?from=${from}&to=${to}`).then((r) => r.data),
    enabled:  tab === 'waiters',
  });

  // ── Summary totals ────────────────────────────────────────────────────────────
  const totalSales = dailySales?.reduce((s: number, d: any) => s + Number(d.gross_sales || 0), 0) || 0;
  const totalBills = dailySales?.reduce((s: number, d: any) => s + Number(d.total_bills || 0), 0) || 0;
  const totalTax   = dailySales?.reduce((s: number, d: any) => s + Number(d.total_tax   || 0), 0) || 0;

  // ── Export handler ────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (tab === 'sales'    && dailySales)   downloadCsv(dailySales,   `sales-${from}-${to}.csv`);
    if (tab === 'items'    && itemSales)    downloadCsv(itemSales,    `item-sales-${from}-${to}.csv`);
    if (tab === 'payments' && payments)     downloadCsv(payments,     `payments-${from}-${to}.csv`);
    if (tab === 'gst'      && gstReport)    downloadCsv(gstReport,    `gst-report-${from}-${to}.csv`);
    if (tab === 'shifts'   && shiftReport)  downloadCsv(shiftReport,  `shifts-${from}-${to}.csv`);
    if (tab === 'waiters'  && waiterReport) downloadCsv(waiterReport, `waiters-${from}-${to}.csv`);
  };

  const fmt = (n: number) =>
    `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-900 dark:text-slate-400">From</span>
            <input type="date" className="input py-1.5" value={from}
              onChange={(e) => setFrom(e.target.value)} max={to} />
            <span className="text-slate-900 dark:text-slate-400">To</span>
            <input type="date" className="input py-1.5" value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from} max={dayjs().format('YYYY-MM-DD')} />
          </div>
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download size={13} /> Export CSV
          </button>
          {tab === 'gst' && (
            <button
              onClick={() => downloadGstr1(from, to)}
              className="btn-secondary text-sm"
            >
              <Download size={13} /> GSTR-1 JSON
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as ReportTab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === id ? 'bg-amber-500 text-slate-900' : 'text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white',
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ════════ SALES TAB ════════ */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Gross Sales', value: fmt(totalSales) },
              { label: 'Total Bills', value: totalBills.toLocaleString('en-IN') },
              { label: 'Total GST',   value: fmt(totalTax) },
            ].map(({ label, value }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value text-xl">{value}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Daily Sales</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailySales?.map((d: any) => ({
                date:  dayjs(d.date).format('D MMM'),
                sales: Number(d.gross_sales),
                tax:   Number(d.total_tax),
                bills: Number(d.total_bills),
              })) || []}>
                <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)' }}
                  formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`}
                />
                <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Sales" />
                <Bar dataKey="tax"   fill="#334155" radius={[4, 4, 0, 0]} name="GST" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th text-right">Bills</th>
                  <th className="th text-right">Gross Sales</th>
                  <th className="th text-right">Discount</th>
                  <th className="th text-right">GST</th>
                  <th className="th text-right">Net Sales</th>
                </tr>
              </thead>
              <tbody>
                {dailySales?.map((d: any) => (
                  <tr key={d.date} className="table-row">
                    <td className="td">{dayjs(d.date).format('D MMM YYYY')}</td>
                    <td className="td text-right">{d.total_bills}</td>
                    <td className="td text-right font-medium text-amber-600 dark:text-amber-400">
                      {fmt(Number(d.gross_sales))}
                    </td>
                    <td className="td text-right text-red-600 dark:text-red-400">
                      {fmt(Number(d.total_discount || 0))}
                    </td>
                    <td className="td text-right text-slate-900 dark:text-slate-400">
                      {fmt(Number(d.total_tax || 0))}
                    </td>
                    <td className="td text-right font-bold">
                      {fmt(Number(d.gross_sales) - Number(d.total_discount || 0))}
                    </td>
                  </tr>
                ))}
                {!dailySales?.length && (
                  <tr>
                    <td colSpan={6} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                      No data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ TOP ITEMS TAB ════════ */}
      {tab === 'items' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Revenue by Item</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={itemSales?.slice(0, 10).map((i: any) => ({
                    name:    i.item_name?.slice(0, 12),
                    revenue: Number(i.total_revenue),
                  })) || []}
                  layout="vertical"
                >
                  <XAxis type="number" tick={{ fill: 'var(--chart-axis-text)', fontSize: 10 }}
                    tickFormatter={(v) => `₹${v}`} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fill: 'var(--chart-axis-text)', fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)' }}
                    formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Item</th>
                    <th className="th text-right">Qty Sold</th>
                    <th className="th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSales?.map((item: any, i: number) => (
                    <tr key={item.menu_item_id || i} className="table-row">
                      <td className="td text-slate-900 dark:text-slate-500">{i + 1}</td>
                      <td className="td font-medium">{item.item_name}</td>
                      <td className="td text-right">{Number(item.total_qty).toFixed(0)}</td>
                      <td className="td text-right text-amber-600 dark:text-amber-400 font-medium">
                        {fmt(Number(item.total_revenue))}
                      </td>
                    </tr>
                  ))}
                  {!itemSales?.length && (
                    <tr>
                      <td colSpan={4} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                        No data for selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════ PAYMENTS TAB ════════ */}
      {tab === 'payments' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Payment Mix</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={payments?.map((p: any) => ({
                    name: p.method, value: Number(p.total_amount),
                  })) || []}
                  dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {payments?.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Method</th>
                  <th className="th text-right">Transactions</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {payments?.map((p: any, i: number) => (
                  <tr key={p.method} className="table-row">
                    <td className="td">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }} />
                        {p.method.toUpperCase()}
                      </span>
                    </td>
                    <td className="td text-right">{p.transaction_count}</td>
                    <td className="td text-right font-bold text-amber-600 dark:text-amber-400">
                      {fmt(Number(p.total_amount))}
                    </td>
                  </tr>
                ))}
                {!payments?.length && (
                  <tr>
                    <td colSpan={3} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                      No data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ GST REPORT TAB ════════ */}
      {tab === 'gst' && (
        <div className="space-y-4">
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Month</th>
                  <th className="th text-right">Invoices</th>
                  <th className="th text-right">Taxable Value</th>
                  <th className="th text-right">CGST</th>
                  <th className="th text-right">SGST</th>
                  <th className="th text-right">IGST</th>
                  <th className="th text-right">Total GST</th>
                  <th className="th text-right">Gross Value</th>
                </tr>
              </thead>
              <tbody>
                {gstReport?.map((row: any) => (
                  <tr key={row.month} className="table-row">
                    <td className="td font-medium">{dayjs(row.month).format('MMMM YYYY')}</td>
                    <td className="td text-right text-slate-900 dark:text-slate-400">{row.total_invoices}</td>
                    <td className="td text-right">{fmt(Number(row.taxable_value))}</td>
                    <td className="td text-right text-blue-400">{fmt(Number(row.cgst))}</td>
                    <td className="td text-right text-purple-400">{fmt(Number(row.sgst))}</td>
                    <td className="td text-right text-emerald-600 dark:text-emerald-400">{fmt(Number(row.igst))}</td>
                    <td className="td text-right font-bold text-amber-600 dark:text-amber-400">
                      {fmt(Number(row.total_tax))}
                    </td>
                    <td className="td text-right font-bold">{fmt(Number(row.gross_value))}</td>
                  </tr>
                ))}
                {!gstReport?.length && (
                  <tr>
                    <td colSpan={8} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                      No data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {gstReport?.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <td className="td font-bold">TOTAL</td>
                    <td className="td text-right font-bold">
                      {gstReport.reduce((s: number, r: any) => s + Number(r.total_invoices || 0), 0)}
                    </td>
                    <td className="td text-right font-bold">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.taxable_value), 0))}
                    </td>
                    <td className="td text-right font-bold text-blue-400">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.cgst), 0))}
                    </td>
                    <td className="td text-right font-bold text-purple-400">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.sgst), 0))}
                    </td>
                    <td className="td text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.igst), 0))}
                    </td>
                    <td className="td text-right font-bold text-amber-600 dark:text-amber-400">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.total_tax), 0))}
                    </td>
                    <td className="td text-right font-bold">
                      {fmt(gstReport.reduce((s: number, r: any) => s + Number(r.gross_value), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-slate-900 dark:text-slate-500">
            * GSTR-1 / GSTR-3B summary. Verify with your CA before filing.
            Use the <strong className="text-slate-600 dark:text-slate-300">GSTR-1 JSON</strong> button above to
            download GST portal-ready JSON.
          </p>
        </div>
      )}

      {/* ════════ SHIFTS TAB ════════ */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          {shiftReport?.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Shifts',  value: shiftReport.length },
                {
                  label: 'Total Revenue',
                  value: fmt(shiftReport.reduce((s: number, r: any) => s + Number(r.total_sales || 0), 0)),
                },
                {
                  label: 'Total Orders',
                  value: shiftReport.reduce((s: number, r: any) => s + Number(r.total_orders || 0), 0),
                },
              ].map(({ label, value }) => (
                <div key={label} className="stat-card">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value text-xl">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Shift</th>
                  <th className="th">Cashier</th>
                  <th className="th">Opened</th>
                  <th className="th">Closed</th>
                  <th className="th text-right">Orders</th>
                  <th className="th text-right">Cash</th>
                  <th className="th text-right">UPI</th>
                  <th className="th text-right">Card</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-center">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {shiftReport?.map((s: any) => (
                  <>
                    <tr
                      key={s.shift_id}
                      className="table-row cursor-pointer"
                      onClick={() => setExpandedShift(
                        expandedShift === s.shift_id ? null : s.shift_id,
                      )}
                    >
                      <td className="td font-medium text-amber-600 dark:text-amber-400">{s.shift_number}</td>
                      <td className="td">{s.cashier_name?.trim() || '—'}</td>
                      <td className="td text-slate-900 dark:text-slate-400">
                        {s.opened_at ? dayjs(s.opened_at).format('D MMM, HH:mm') : '—'}
                      </td>
                      <td className="td text-slate-900 dark:text-slate-400">
                        {s.closed_at ? dayjs(s.closed_at).format('D MMM, HH:mm') : '—'}
                      </td>
                      <td className="td text-right">{s.total_orders}</td>
                      <td className="td text-right">{fmt(Number(s.cash_sales))}</td>
                      <td className="td text-right">{fmt(Number(s.upi_sales))}</td>
                      <td className="td text-right">{fmt(Number(s.card_sales))}</td>
                      <td className="td text-right font-bold text-amber-600 dark:text-amber-400">
                        {fmt(Number(s.total_sales))}
                      </td>
                      <td className="td text-center">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          s.status === 'closed'
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-400'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                        )}>
                          {s.status}
                        </span>
                      </td>
                      <td className="td text-slate-900 dark:text-slate-500">
                        {expandedShift === s.shift_id
                          ? <ChevronUp size={14} />
                          : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {expandedShift === s.shift_id && (
                      <tr key={`${s.shift_id}-expanded`} className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="grid grid-cols-4 gap-4 text-xs">
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">Opening Cash</div>
                              <div className="font-medium">{fmt(Number(s.opening_cash || 0))}</div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">Closing Cash</div>
                              <div className="font-medium">{fmt(Number(s.closing_cash || 0))}</div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">Complimentary</div>
                              <div className="font-medium text-emerald-600 dark:text-emerald-400">
                                {fmt(Number(s.complimentary || 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">Wallet Sales</div>
                              <div className="font-medium">{fmt(Number(s.wallet_sales || 0))}</div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">CGST Collected</div>
                              <div className="font-medium text-blue-400">
                                {fmt(Number(s.total_cgst || 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">SGST Collected</div>
                              <div className="font-medium text-purple-400">
                                {fmt(Number(s.total_sgst || 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">IGST Collected</div>
                              <div className="font-medium text-emerald-600 dark:text-emerald-400">
                                {fmt(Number(s.total_igst || 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-slate-500 mb-1">Credit Sales</div>
                              <div className="font-medium text-orange-400">
                                {fmt(Number(s.credit_sales || 0))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {!shiftReport?.length && (
                  <tr>
                    <td colSpan={11} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                      No shifts found for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ WAITERS TAB ════════ */}
      {tab === 'waiters' && (
        <div className="space-y-4">
          {waiterReport?.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Active Waiters', value: waiterReport.length },
                {
                  label: 'Total Revenue',
                  value: fmt(waiterReport.reduce((s: number, r: any) => s + Number(r.total_revenue || 0), 0)),
                },
                {
                  label: 'Total Orders',
                  value: waiterReport.reduce((s: number, r: any) => s + Number(r.total_orders || 0), 0),
                },
              ].map(({ label, value }) => (
                <div key={label} className="stat-card">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value text-xl">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Waiter</th>
                  <th className="th">Emp Code</th>
                  <th className="th text-right">Orders</th>
                  <th className="th text-right">Dine In</th>
                  <th className="th text-right">Takeaway</th>
                  <th className="th text-right">Tables</th>
                  <th className="th text-right">Avg Order</th>
                  <th className="th text-right">Avg Time</th>
                  <th className="th text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {waiterReport?.map((w: any, i: number) => (
                  <tr key={w.waiter_id} className="table-row">
                    <td className="td text-slate-900 dark:text-slate-500">{i + 1}</td>
                    <td className="td font-medium">{w.waiter_name?.trim() || '—'}</td>
                    <td className="td text-slate-900 dark:text-slate-400">{w.employee_code || '—'}</td>
                    <td className="td text-right">{w.total_orders}</td>
                    <td className="td text-right text-slate-900 dark:text-slate-400">{w.dine_in_orders}</td>
                    <td className="td text-right text-slate-900 dark:text-slate-400">{w.takeaway_orders}</td>
                    <td className="td text-right">{w.tables_served}</td>
                    <td className="td text-right">{fmt(Number(w.avg_order_value))}</td>
                    <td className="td text-right">
                      {Math.round(Number(w.avg_turnaround_min || 0))} min
                    </td>
                    <td className="td text-right font-bold text-amber-600 dark:text-amber-400">
                      {fmt(Number(w.total_revenue))}
                    </td>
                  </tr>
                ))}
                {!waiterReport?.length && (
                  <tr>
                    <td colSpan={10} className="td text-center text-slate-900 dark:text-slate-500 py-8">
                      No waiter data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}