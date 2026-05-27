'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost, apiPut } from '@/lib/api';
import toast from 'react-hot-toast';
import { Package, AlertTriangle, Plus, ArrowUp, ArrowDown, RefreshCw, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const TXN_TYPES = ['purchase', 'sale', 'waste', 'adjustment', 'opening', 'transfer'];

export default function InventoryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'items' | 'alerts' | 'ledger'>('items');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ type: 'purchase', quantity: '', unitCost: '', notes: '' });
  const [itemForm, setItemForm] = useState({ name: '', sku: '', minStockLevel: '', reorderLevel: '', isPerishable: false });

  const { data: items } = useQuery({ queryKey: ['invItems'], queryFn: () => apiFetch('/api/v1/inventory/items').then((r) => r.data) });
  const { data: alerts } = useQuery({ queryKey: ['invAlerts'], queryFn: () => apiFetch('/api/v1/inventory/alerts').then((r) => r.data), enabled: tab === 'alerts' });
  const { data: ledger } = useQuery({ queryKey: ['ledger', selectedItem?.id], queryFn: () => apiFetch(`/api/v1/inventory/items/${selectedItem?.id}/ledger`).then((r) => r.data), enabled: !!selectedItem });

  const txnMutation = useMutation({
    mutationFn: () => apiPost('/api/v1/inventory/transactions', {
      itemId: selectedItem.id,
      type: txnForm.type,
      quantity: parseFloat(txnForm.quantity),
      unitCost: parseFloat(txnForm.unitCost) || 0,
      notes: txnForm.notes,
    }),
    onSuccess: () => { toast.success('Stock updated'); qc.invalidateQueries({ queryKey: ['invItems'] }); qc.invalidateQueries({ queryKey: ['ledger'] }); setShowTxnForm(false); setTxnForm({ type: 'purchase', quantity: '', unitCost: '', notes: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const createItemMutation = useMutation({
    mutationFn: () => apiPost('/api/v1/inventory/items', { ...itemForm, minStockLevel: parseFloat(itemForm.minStockLevel) || 0, reorderLevel: parseFloat(itemForm.reorderLevel) || 0 }),
    onSuccess: () => { toast.success('Item created'); qc.invalidateQueries({ queryKey: ['invItems'] }); setShowItemForm(false); },
    onError: () => toast.error('Failed to create item'),
  });

  const STOCK_STATUS: Record<string, { badge: string; label: string }> = {
    adequate:     { badge: 'badge-green',  label: 'In Stock'     },
    low_stock:    { badge: 'badge-yellow', label: 'Low Stock'    },
    reorder:      { badge: 'badge-yellow', label: 'Reorder'      },
    out_of_stock: { badge: 'badge-red',    label: 'Out of Stock' },
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inventory</h1>
        <button onClick={() => setShowItemForm(true)} className="btn-primary"><Plus size={14} /> Add Item</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(['items', 'alerts', 'ledger'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize', tab === t ? 'bg-amber-500 text-slate-900' : 'text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white')}>
            {t === 'alerts' ? `⚠️ Alerts${alerts?.length ? ` (${alerts.length})` : ''}` : t}
          </button>
        ))}
      </div>

      {/* Items table */}
      {tab === 'items' && (
        <>
          {/* Stock filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all',          label: 'All' },
              { key: 'adequate',     label: 'In Stock' },
              { key: 'low_stock',    label: 'Low Stock' },
              { key: 'reorder',      label: 'Reorder' },
              { key: 'out_of_stock', label: 'Out of Stock' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStockFilter(key)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  stockFilter === key
                    ? 'bg-amber-500 text-slate-900 border-amber-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-400 hover:border-slate-500',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Item</th><th className="th">SKU</th><th className="th text-right">Stock</th>
                  <th className="th text-right">Min Level</th><th className="th">Status</th><th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items
                  ?.map((item: any) => {
                    // Support both camelCase (TypeORM entity) and snake_case (raw query)
                    const stockAmt = Number(item.currentStock ?? item.current_stock ?? 0);
                    const minAmt   = Number(item.minStockLevel ?? item.min_stock_level ?? 0);
                    const reorder  = Number(item.reorderLevel  ?? item.reorder_level  ?? 0);
                    const status   = stockAmt <= 0 ? 'out_of_stock'
                                   : stockAmt <= minAmt  ? 'low_stock'
                                   : stockAmt <= reorder ? 'reorder'
                                   : 'adequate';
                    return { ...item, _stockAmt: stockAmt, _minAmt: minAmt, _status: status };
                  })
                  .filter((item: any) => stockFilter === 'all' || item._status === stockFilter)
                  .map((item: any) => {
                    const s = STOCK_STATUS[item._status];
                    return (
                      <tr key={item.id} className="table-row">
                        <td className="td font-medium">{item.name}</td>
                        <td className="td text-slate-900 dark:text-slate-500">{item.sku || '—'}</td>
                        <td className="td text-right font-mono">{item._stockAmt.toFixed(2)}</td>
                        <td className="td text-right text-slate-900 dark:text-slate-500">{item._minAmt}</td>
                        <td className="td"><span className={s.badge}>{s.label}</span></td>
                        <td className="td">
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedItem(item); setTxnForm({ type: 'purchase', quantity: '', unitCost: '', notes: '' }); setShowTxnForm(true); }} className="btn-secondary py-1 px-2 text-xs">
                              <ArrowUp size={10} /> Stock In
                            </button>
                            <button onClick={() => { setSelectedItem(item); setTab('ledger'); }} className="btn-ghost py-1 px-2 text-xs">
                              <History size={10} /> Ledger
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Alerts */}
      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts?.length === 0 && <div className="text-center py-12 text-slate-900 dark:text-slate-500">✅ All stock levels are adequate</div>}
          {alerts?.map((item: any) => (
            <div key={item.id} className="card flex items-center gap-4 border-red-300 dark:border-red-800/50">
              <AlertTriangle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                <div className="text-xs text-slate-900 dark:text-slate-400">Current: {item.current_stock} | Min: {item.min_stock_level}</div>
              </div>
              <span className="badge-red">{item.stock_status?.replace('_', ' ')}</span>
              <button onClick={() => { setSelectedItem({ id: item.id, name: item.name }); setShowTxnForm(true); }} className="btn-secondary text-xs">Restock</button>
            </div>
          ))}
        </div>
      )}

      {/* Ledger */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select className="input w-64" onChange={(e) => { const item = items?.find((i: any) => i.id === e.target.value); setSelectedItem(item); }}>
              <option value="">— Select item —</option>
              {items?.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {selectedItem && <span className="text-sm text-slate-900 dark:text-slate-400">Stock: <span className="text-slate-900 dark:text-white font-bold">{Number(selectedItem.currentStock).toFixed(2)}</span></span>}
          </div>
          {ledger && (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                  <tr><th className="th">Date</th><th className="th">Type</th><th className="th text-right">Qty</th><th className="th text-right">Cost</th><th className="th text-right">Balance</th><th className="th">Notes</th></tr>
                </thead>
                <tbody>
                  {ledger.map((row: any) => (
                    <tr key={row.id} className="table-row">
                      <td className="td text-xs text-slate-900 dark:text-slate-400">{new Date(row.createdAt).toLocaleString('en-IN')}</td>
                      <td className="td"><span className="badge-slate capitalize">{row.type}</span></td>
                      <td className={cn('td text-right font-mono', ['sale', 'waste'].includes(row.type) ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {['sale', 'waste'].includes(row.type) ? '-' : '+'}{row.quantity}
                      </td>
                      <td className="td text-right text-slate-900 dark:text-slate-400">₹{row.unitCost || 0}</td>
                      <td className="td text-right font-mono font-bold">{Number(row.balanceAfter).toFixed(2)}</td>
                      <td className="td text-slate-900 dark:text-slate-500 text-xs">{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction Modal */}
      {showTxnForm && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Stock Transaction — {selectedItem.name}</h3>
            <div>
              <label className="label">Transaction Type</label>
              <select className="input" value={txnForm.type} onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })}>
                {TXN_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div><label className="label">Quantity *</label><input className="input" type="number" min="0.001" step="0.001" value={txnForm.quantity} onChange={(e) => setTxnForm({ ...txnForm, quantity: e.target.value })} /></div>
            {txnForm.type === 'purchase' && <div><label className="label">Unit Cost (₹)</label><input className="input" type="number" min="0" step="0.01" value={txnForm.unitCost} onChange={(e) => setTxnForm({ ...txnForm, unitCost: e.target.value })} /></div>}
            <div><label className="label">Notes</label><input className="input" value={txnForm.notes} onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })} placeholder="Optional" /></div>
            <div className="flex gap-3">
              <button onClick={() => setShowTxnForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => txnMutation.mutate()} disabled={txnMutation.isPending || !txnForm.quantity} className="btn-primary flex-1">
                {txnMutation.isPending ? 'Saving...' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Item Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Add Inventory Item</h3>
            <div><label className="label">Name *</label><input className="input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
            <div><label className="label">SKU</label><input className="input" value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Min Stock</label><input className="input" type="number" value={itemForm.minStockLevel} onChange={(e) => setItemForm({ ...itemForm, minStockLevel: e.target.value })} /></div>
              <div><label className="label">Reorder At</label><input className="input" type="number" value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: e.target.value })} /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowItemForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createItemMutation.mutate()} disabled={createItemMutation.isPending || !itemForm.name} className="btn-primary flex-1">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
