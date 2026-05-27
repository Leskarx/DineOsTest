'use client';
import { cn } from '@/lib/utils';

const TYPES = [
  { id: 'dine_in', label: 'Dine In', icon: '🍽️' },
  { id: 'takeaway', label: 'Takeaway', icon: '🥡' },
  { id: 'delivery', label: 'Delivery', icon: '🛵' },
];

interface Props {
  value: string;
  onChange: (v: any) => void;
}

export function OrderTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1">
      {TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all', value === t.id ? 'bg-amber-500 text-slate-900' : 'text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white')}
        >
          <span>{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}
