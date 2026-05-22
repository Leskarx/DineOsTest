'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Receipt, Package, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

/** Convert an array of objects to a CSV string and download it */
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

type ReportTab = 'sales' | 'items' | 'payments' | 'gst';

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('sales');
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: dailySales } = useQuery({
    queryKey: ['report-daily', from, to],
    queryFn: () => apiFetch(`/api/v1/reports/daily-sales?from=${from}&to=${to}`).then((r) => r.data),
    enabled: tab === 'sales',
  });

  const { data: itemSales } = useQuery({
    queryKey: ['report-items', from, to],
    queryFn: () => apiFetch(`/api/v1/reports/items?from=${from}&to=${to}`).then((r) => r.data),
    enabled: tab === 'items',
  });

  const { data: payments } = useQuery({
    queryKey: ['report-payments', from, to],
    queryFn: () => apiFetch(`/api/v1/reports/payments?from=${from}&to=${to}`).then((r) => r.data),
    enabled: tab === 'payments',
  });

  const { data: gstReport } = useQuery({
    queryKey: ['report-gst', from, to],
    queryFn: () => apiFetch(`/api/v1/reports/gst?from=${from}&to=${to}`).then((r) => r.data),
    enabled: tab === 'gst',
  });

  const totalSales = dailySales?.reduce((s: number, d: any) => s + Number(d.gross_sales || 0), 0) || 0;
  const totalBills = dailySales?.reduce((s: number, d: any) => s + Number(d.total_bills || 0), 0) || 0;
  const totalTax = dailySales?.reduce((s: number, d: any) => s + Number(d.total_tax || 0), 0) || 0;

  const TABS = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'items', label: 'Top Items', icon: Package },
    { id: 'payments', label: 'Payments', icon: Receipt },
    { id: 'gst', label: 'GST Report', icon: FileText },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">From</span>
            <input type="date" className="input py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
            <span className="text-slate-400">To</span>
            <input type="date" className="input py-1.5" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={dayjs().format('YYYY-MM-DD')} />
          </div>
          <button
            onClick={() => {
              if (tab === 'sales' && dailySales) downloadCsv(dailySales, `sales-${from}-${to}.csv`);
              else if (tab === 'items' && itemSales) downloadCsv(itemSales, `item-sales-${from}-${to}.csv`);
              else if (tab === 'payments' && payments) downloadCsv(payments, `payments-${from}-${to}.csv`);
              else if (tab === 'gst' && gstReport) downloadCsv(gstReport, `gst-report-${from}-${to}.csv`);
            }}
            className="btn-secondary text-sm"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as ReportTab)} className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors', tab === id ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white')}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Gross Sales', value: `₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              { label: 'Total Bills', value: totalBills.toLocaleString('en-IN') },
              { label: 'Total GST', value: `₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            ].map(({ label, value }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value text-xl">{value}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Sales</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailySales?.map((d: any) => ({ date: dayjs(d.date).format('D MMM'), sales: Number(d.gross_sales), tax: Number(d.total_tax), bills: Number(d.total_bills) })) || []}>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Sales" />
                <Bar dataKey="tax" fill="#334155" radius={[4, 4, 0, 0]} name="GST" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50"><tr><th className="th">Date</th><th className="th text-right">Bills</th><th className="th text-right">Gross Sales</th><th className="th text-right">Discount</th><th className="th text-right">GST</th><th className="th text-right">Net Sales</th></tr></thead>
              <tbody>
                {dailySales?.map((d: any) => (
                  <tr key={d.date} className="table-row">
                    <td className="td">{dayjs(d.date).format('D MMM YYYY')}</td>
                    <td className="td text-right">{d.total_bills}</td>
                    <td className="td text-right font-medium text-amber-400">₹{Number(d.gross_sales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="td text-right text-red-400">₹{Number(d.total_discount || 0).toFixed(2)}</td>
                    <td className="td text-right text-slate-400">₹{Number(d.total_tax || 0).toFixed(2)}</td>
                    <td className="td text-right font-bold">₹{(Number(d.gross_sales) - Number(d.total_discount || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Items */}
      {tab === 'items' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Revenue by Item</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={itemSales?.slice(0, 10).map((i: any) => ({ name: i.item_name?.slice(0, 12), revenue: Number(i.total_revenue) })) || []} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50"><tr><th className="th">#</th><th className="th">Item</th><th className="th text-right">Qty Sold</th><th className="th text-right">Revenue</th></tr></thead>
                <tbody>
                  {itemSales?.map((item: any, i: number) => (
                    <tr key={item.menu_item_id || i} className="table-row">
                      <td className="td text-slate-500">{i + 1}</td>
                      <td className="td font-medium">{item.item_name}</td>
                      <td className="td text-right">{Number(item.total_qty).toFixed(0)}</td>
                      <td className="td text-right text-amber-400 font-medium">₹{Number(item.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments */}
      {tab === 'payments' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Payment Mix</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={payments?.map((p: any) => ({ name: p.method, value: Number(p.total_amount) })) || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {payments?.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50"><tr><th className="th">Method</th><th className="th text-right">Transactions</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {payments?.map((p: any, i: number) => (
                  <tr key={p.method} className="table-row">
                    <td className="td"><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.method.toUpperCase()}</span></td>
                    <td className="td text-right">{p.transaction_count}</td>
                    <td className="td text-right font-bold text-amber-400">₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GST Report */}
      {tab === 'gst' && (
        <div className="space-y-4">
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="th">Month</th>
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
                    <td className="td text-right">₹{Number(row.taxable_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="td text-right text-blue-400">₹{Number(row.cgst).toFixed(2)}</td>
                    <td className="td text-right text-purple-400">₹{Number(row.sgst).toFixed(2)}</td>
                    <td className="td text-right text-emerald-400">₹{Number(row.igst).toFixed(2)}</td>
                    <td className="td text-right font-bold text-amber-400">₹{Number(row.total_tax).toFixed(2)}</td>
                    <td className="td text-right font-bold">₹{Number(row.gross_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              {gstReport?.length > 0 && (
                <tfoot className="bg-slate-800/80">
                  <tr>
                    <td className="td font-bold">TOTAL</td>
                    <td className="td text-right font-bold">₹{gstReport.reduce((s: number, r: any) => s + Number(r.taxable_value), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="td text-right font-bold text-blue-400">₹{gstReport.reduce((s: number, r: any) => s + Number(r.cgst), 0).toFixed(2)}</td>
                    <td className="td text-right font-bold text-purple-400">₹{gstReport.reduce((s: number, r: any) => s + Number(r.sgst), 0).toFixed(2)}</td>
                    <td className="td text-right font-bold text-emerald-400">₹{gstReport.reduce((s: number, r: any) => s + Number(r.igst), 0).toFixed(2)}</td>
                    <td className="td text-right font-bold text-amber-400">₹{gstReport.reduce((s: number, r: any) => s + Number(r.total_tax), 0).toFixed(2)}</td>
                    <td className="td text-right font-bold">₹{gstReport.reduce((s: number, r: any) => s + Number(r.gross_value), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-slate-500">* GSTR-1 / GSTR-3B summary. Verify with your CA before filing.</p>
        </div>
      )}
    </div>
  );
}
