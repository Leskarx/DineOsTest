'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Store, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function BranchSwitcher() {
  const { user, branchId, setBranch } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiFetch('/api/v1/branches').then((r) => r.data),
    enabled: user?.role === 'owner',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (user?.role !== 'owner') return null;

  const currentBranch = branches?.find((b: any) => b.id === branchId);
  const displayLabel = currentBranch ? currentBranch.name : 'All Branches (Global)';

  return (
    <div className="relative px-4 pb-3 border-b border-slate-800" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 transition-colors text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Store size={14} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">{displayLabel}</span>
        </div>
        <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-4 right-4 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            onClick={() => { setBranch(null); setIsOpen(false); window.location.reload(); }}
            className={cn(
              'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-700',
              !branchId ? 'text-amber-400 font-bold bg-slate-900/50' : 'text-slate-300'
            )}
          >
            All Branches (Global)
          </button>
          
          {branches?.map((b: any) => (
            <button
              key={b.id}
              onClick={() => { setBranch(b.id); setIsOpen(false); window.location.reload(); }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-700 truncate',
                branchId === b.id ? 'text-amber-400 font-bold bg-slate-900/50' : 'text-slate-300'
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
