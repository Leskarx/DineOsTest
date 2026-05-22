'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { usePosStore } from '@/store/pos.store';
import { X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  available: 'border-emerald-600 bg-emerald-900/20 text-emerald-300',
  occupied: 'border-red-600 bg-red-900/20 text-red-300 opacity-60',
  reserved: 'border-amber-600 bg-amber-900/20 text-amber-300',
  cleaning: 'border-slate-600 bg-slate-800 text-slate-400 opacity-50',
};

export function TablePickerModal({ onClose }: { onClose: () => void }) {
  const { tableId, setTable } = usePosStore();

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: () => apiFetch('/api/v1/tables').then((r) => r.data),
  });

  const handleSelect = (table: any) => {
    if (table.status === 'occupied' || table.status === 'cleaning') return;
    setTable(table.id, table.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Select Table</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-4 grid grid-cols-4 gap-3 max-h-96 overflow-y-auto">
          {tables?.map((t: any) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              disabled={t.status === 'occupied' || t.status === 'cleaning'}
              className={cn('relative rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-all active:scale-95', STATUS_STYLES[t.status] || STATUS_STYLES.available, tableId === t.id && 'ring-2 ring-amber-400')}
            >
              {tableId === t.id && <CheckCircle size={12} className="absolute top-1.5 right-1.5 text-amber-400" />}
              <span className="font-bold text-sm">{t.name}</span>
              <span className="text-xs opacity-70 capitalize">{t.status}</span>
              <span className="text-xs opacity-60">{t.capacity} seats</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Occupied</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Reserved</span>
        </div>
      </div>
    </div>
  );
}
