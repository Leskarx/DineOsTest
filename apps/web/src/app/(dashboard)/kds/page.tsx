'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPatch } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  CheckCircle, RefreshCw, Clock, ChefHat,
  AlertCircle, Volume2, VolumeX, FlameKindling, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KdsTicketSkeleton } from '@/components/ui/Skeleton';

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioContext: AudioContext | null = null;

function playBeep(frequency = 880, duration = 0.18, volume = 0.4) {
  if (typeof window === 'undefined') return;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

// ─── Stations ─────────────────────────────────────────────────────────────────
const STATIONS = [
  { id: 'all',  label: 'All Stations',    icon: '📋', keywords: [] },
  { id: 'hot',  label: 'Hot Kitchen',     icon: '🔥', keywords: ['starter', 'main', 'curry', 'grill', 'tandoor', 'soup', 'rice', 'tikka', 'dal', 'chicken', 'mutton', 'fish', 'bread', 'roti', 'naan', 'paneer'] },
  { id: 'cold', label: 'Cold Section',    icon: '🧊', keywords: ['salad', 'raita', 'cold', 'yogurt', 'lassi', 'shake', 'ice', 'dessert', 'sweet', 'gulab', 'kheer', 'halwa'] },
  { id: 'bar',  label: 'Bar / Beverages', icon: '🥤', keywords: ['beer', 'wine', 'whisky', 'rum', 'gin', 'vodka', 'cocktail', 'mocktail', 'juice', 'soda', 'water', 'beverage', 'drink', 'lime', 'mango lassi'] },
] as const;

type StationId = typeof STATIONS[number]['id'];
const STATION_KEY = 'dinestay:kds:station';
const URGENT_SECS = 600;

interface KDSItem {
  order_item_id: string;
  order_id: string;
  order_order_number: string;
  item_name: string;
  category_name?: string;
  quantity: number;
  notes?: string;
  kds_status: 'pending' | 'acknowledged' | 'preparing' | 'ready';
  age_seconds: number;
  order_type?: string;
  table_name?: string;
  created_at: string;
  kds_ready_at?: string;
}

function matchesStation(item: KDSItem, stationId: StationId): boolean {
  if (stationId === 'all') return true;
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station?.keywords.length) return true;
  const haystack = `${item.item_name || ''} ${item.category_name || ''}`.toLowerCase();
  return station.keywords.some((kw) => haystack.includes(kw));
}

// ─── Live timer ───────────────────────────────────────────────────────────────
function useAgeSeconds(createdAt: string, readyAt?: string | null): number {
  const [age, setAge] = useState(() => {
    if (readyAt) return Math.floor((new Date(readyAt).getTime() - new Date(createdAt).getTime()) / 1000);
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  });

  useEffect(() => {
    if (readyAt) {
      setAge(Math.floor((new Date(readyAt).getTime() - new Date(createdAt).getTime()) / 1000));
      return;
    }
    const interval = setInterval(() => {
      setAge(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, readyAt]);

  return Math.max(0, age);
}

function formatAge(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ─── Ticket card ──────────────────────────────────────────────────────────────
function TicketCard({
  orderNum,
  tickets,
  onStartCooking,
  onMarkReady,
  onBump,
  isBumping,
  isMarkingReady,
  isStartingCooking,
}: {
  orderNum: string;
  tickets: KDSItem[];
  onStartCooking: (ids: string[]) => void;
  onMarkReady: (ids: string[]) => void;
  onBump: (ids: string[]) => void;
  isBumping: boolean;
  isMarkingReady: boolean;
  isStartingCooking: boolean;
}) {
  const oldest = [...tickets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )[0];

  const allReady     = tickets.every((t) => t.kds_status === 'ready');
  const anyPending   = tickets.some((t) => t.kds_status === 'pending');
  const anyPreparing = tickets.some((t) => t.kds_status === 'preparing' || t.kds_status === 'acknowledged');

  let latestReadyAt = null;
  if (allReady) {
    const sortedReady = [...tickets].filter(t => t.kds_ready_at).sort(
      (a, b) => new Date(b.kds_ready_at!).getTime() - new Date(a.kds_ready_at!).getTime()
    );
    if (sortedReady.length > 0) latestReadyAt = sortedReady[0].kds_ready_at;
  }

  const ageSeconds = useAgeSeconds(oldest?.created_at || new Date().toISOString(), latestReadyAt);
  const isUrgent   = !allReady && ageSeconds > URGENT_SECS;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-2xl border shadow-lg overflow-hidden flex flex-col min-h-[280px] transition-all',
        allReady && 'border-emerald-500/70 ring-1 ring-emerald-500/30',
        !allReady && anyPending && 'border-orange-500/70',
        !allReady && !anyPending && anyPreparing && 'border-blue-500/50',
        isUrgent && 'ring-2 ring-red-500/60 animate-pulse',
        !allReady && !anyPending && !anyPreparing && !isUrgent && 'border-slate-300 dark:border-slate-700',
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900 dark:text-white text-lg truncate">
            #{oldest?.order_order_number || orderNum}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-900 dark:text-slate-400 flex-wrap">
            <span className="capitalize">
              {oldest?.order_type?.replace('_', ' ') || 'dine in'}
            </span>
            {oldest?.table_name && (
              <>
                <span>·</span>
                <span>Table {oldest.table_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm flex-shrink-0 ml-3">
          {isUrgent && <AlertCircle size={16} className="text-red-600 dark:text-red-400" />}
          <Clock size={14} className={isUrgent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-400'} />
          <span className={cn('font-semibold tabular-nums', isUrgent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-400')}>
            {formatAge(ageSeconds)}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
        {tickets.map((ticket) => (
          <div
            key={ticket.order_item_id}
            className={cn(
              'rounded-xl bg-slate-50 dark:bg-slate-800/70 border p-3 flex items-start gap-3 transition-opacity',
              ticket.kds_status === 'ready'        && 'border-emerald-500/30 bg-emerald-500/5',
              ticket.kds_status === 'pending'      && 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5',
              ticket.kds_status === 'preparing'    && 'border-blue-500/30 bg-blue-500/5',
              ticket.kds_status === 'acknowledged' && 'border-blue-500/30 bg-blue-500/5',
            )}
          >
            <div className="min-w-[52px] h-12 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
              {parseInt(String(ticket.quantity))}×
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white font-semibold text-base leading-snug break-words">
                {ticket.item_name}
              </p>
              {ticket.notes && (
                <div className="mt-2 inline-flex rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1">
                  <span className="text-red-300 text-xs font-medium">
                    📝 {ticket.notes}
                  </span>
                </div>
              )}
              {(ticket.kds_status === 'preparing' || ticket.kds_status === 'acknowledged') && (
                <span className="mt-1 text-xs text-blue-400 block">👨‍🍳 Cooking...</span>
              )}
              {ticket.kds_status === 'ready' && (
                <span className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 block">✅ Ready for pickup</span>
              )}
            </div>

            {ticket.kds_status === 'ready' && (
              <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/70">
        {allReady ? (
          <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold py-2.5 px-3 text-sm">
            <CheckCircle size={15} />
            Ready for Service
          </div>
        ) : (
          <div className={cn('grid gap-3', anyPending && anyPreparing ? 'grid-cols-2' : 'grid-cols-1')}>
            {anyPending && (
              <button
                onClick={() => {
                  const ids = tickets
                    .filter((t) => t.kds_status === 'pending')
                    .map((t) => t.order_item_id);
                  onStartCooking(ids);
                }}
                disabled={isStartingCooking}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 transition-all text-slate-900 dark:text-white font-medium py-2.5 px-3 text-sm disabled:opacity-50"
              >
                {isStartingCooking
                  ? <Loader2 size={15} className="animate-spin" />
                  : <ChefHat size={15} />}
                Start Cooking
              </button>
            )}

            {(anyPreparing || anyPending) && (
              <button
                onClick={() => {
                  const ids = tickets
                    .filter((t) => t.kds_status === 'pending' || t.kds_status === 'preparing' || t.kds_status === 'acknowledged')
                    .map((t) => t.order_item_id);
                  onMarkReady(ids);
                }}
                disabled={isMarkingReady}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 transition-all text-slate-950 font-bold py-2.5 px-3 text-sm disabled:opacity-50"
              >
                {isMarkingReady
                  ? <Loader2 size={15} className="animate-spin" />
                  : <CheckCircle size={15} />}
                Mark Ready
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────
export default function KdsPage() {
  const qc = useQueryClient();
  const isMutatingRef = useRef(false);

  const [soundOn,  setSoundOn]  = useState(true);
  const [station,  setStation]  = useState<StationId>('all');
  const [bumping,  setBumping]  = useState<Set<string>>(new Set());
  const [marking,  setMarking]  = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState<Set<string>>(new Set());

  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATION_KEY) as StationId | null;
      if (saved && STATIONS.find((s) => s.id === saved)) setStation(saved);
    } catch { /* ignore */ }
  }, []);

  const switchStation = (s: StationId) => {
    setStation(s);
    try { localStorage.setItem(STATION_KEY, s); } catch { /* ignore */ }
  };

  useEffect(() => {
    const init = () => { if (audioContext) audioContext.resume().catch(() => {}); };
    document.addEventListener('click', init, { once: true });
    return () => document.removeEventListener('click', init);
  }, []);

  const { data: items, refetch, isLoading, error } = useQuery({
    queryKey: ['kds-pending'],
    queryFn:  () => apiFetch('/api/v1/kds/pending').then((r) => r.data),
    refetchInterval: (starting.size > 0 || marking.size > 0 || bumping.size > 0) ? false : 15_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!items || !Array.isArray(items)) return;
    const filtered = station === 'all'
      ? items
      : items.filter((i: KDSItem) => matchesStation(i, station));
    const count = filtered.filter((i: KDSItem) => i.kds_status === 'pending').length;
    if (prevCountRef.current !== null && count > prevCountRef.current && soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
    prevCountRef.current = count;
  }, [items, soundOn, station]);

  const handleRefetch = useCallback(() => {
    if (isMutatingRef.current) return;
    qc.invalidateQueries({ queryKey: ['kds-pending'] });
  }, [qc]);

  const handleNewOrder = useCallback(() => {
    handleRefetch();
    if (soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
  }, [handleRefetch, soundOn]);

  useSocket('order:created', handleNewOrder);
  useSocket('order:itemsAdded', handleNewOrder);
  useSocket('order:statusChanged', handleRefetch);
  useSocket('kds:itemStatusChanged', handleRefetch);

  const startCooking = useCallback(async (ids: string[]) => {
    isMutatingRef.current = true;
    setStarting((s) => new Set([...Array.from(s), ...ids]));
    
    await qc.cancelQueries({ queryKey: ['kds-pending'] });
    // Optimistic update
    qc.setQueryData(['kds-pending'], (oldData: KDSItem[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(item => 
        ids.includes(item.order_item_id) ? { ...item, kds_status: 'preparing' } : item
      );
    });

    try {
      await Promise.all(
        ids.map((id) => apiPatch(`/api/v1/kds/items/${id}/status`, { status: 'preparing' })),
      );
    } finally {
      qc.invalidateQueries({ queryKey: ['kds-pending'] });
      setStarting((s) => {
        const next = new Set(Array.from(s));
        ids.forEach(id => next.delete(id));
        return next;
      });
      isMutatingRef.current = false;
    }
  }, [qc]);

  const markReady = useCallback(async (ids: string[]) => {
    isMutatingRef.current = true;
    setMarking((s) => new Set([...Array.from(s), ...ids]));
    
    await qc.cancelQueries({ queryKey: ['kds-pending'] });
    // Optimistic update
    qc.setQueryData(['kds-pending'], (oldData: KDSItem[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(item => 
        ids.includes(item.order_item_id) ? { ...item, kds_status: 'ready' } : item
      );
    });

    try {
      await Promise.all(
        ids.map((id) => apiPatch(`/api/v1/kds/items/${id}/status`, { status: 'ready' })),
      );
    } finally {
      qc.invalidateQueries({ queryKey: ['kds-pending'] });
      setMarking((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      isMutatingRef.current = false;
    }
  }, [qc]);

  const bump = useCallback(async (ids: string[]) => {
    isMutatingRef.current = true;
    setBumping((s) => new Set([...Array.from(s), ...ids]));

    await qc.cancelQueries({ queryKey: ['kds-pending'] });
    // Optimistic update
    qc.setQueryData(['kds-pending'], (oldData: KDSItem[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.filter(item => !ids.includes(item.order_item_id));
    });

    try {
      await Promise.all(
        ids.map((id) => apiPatch(`/api/v1/kds/items/${id}/bump`, {})),
      );
    } finally {
      qc.invalidateQueries({ queryKey: ['kds-pending'] });
      setBumping((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      isMutatingRef.current = false;
    }
  }, [qc]);

  const filtered = (Array.isArray(items) ? items : []).filter(
    (i: KDSItem) => matchesStation(i, station),
  );

  const grouped = filtered.reduce((acc: Record<string, KDSItem[]>, item: KDSItem) => {
    const key = item.order_order_number || item.order_item_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const pendingCount = filtered.filter((i: KDSItem) => i.kds_status === 'pending').length;
  const readyCount   = filtered.filter((i: KDSItem) => i.kds_status === 'ready').length;

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-950 flex flex-col">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <ChefHat size={20} className="text-amber-600 dark:text-amber-400" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Kitchen Display</h1>
          </div>
        </div>
        <div className="flex-1 p-5 overflow-y-auto">
          <KdsTicketSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="text-red-600 dark:text-red-400 mx-auto mb-4" size={48} />
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Failed to load orders</p>
          <button onClick={() => refetch()} className="btn-primary">
            <RefreshCw size={16} className="mr-2" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-amber-600 dark:text-amber-400" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Kitchen Display</h1>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
              {Object.keys(grouped).length} active
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-slate-900 dark:text-white text-xs font-medium">
                {pendingCount} pending
              </span>
            )}
            {readyCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-slate-900 dark:text-white text-xs font-medium">
                {readyCount} ready
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => setSoundOn((s) => !s)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              soundOn
                ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:bg-amber-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700',
            )}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundOn ? 'Mute' : 'Unmute'}
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Station bar */}
      <div className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        <span className="text-xs text-slate-900 dark:text-slate-500 font-medium mr-1 whitespace-nowrap flex items-center gap-1">
          <FlameKindling size={12} /> Station:
        </span>
        {STATIONS.map((s) => {
          const sItems = s.id === 'all'
            ? (items || [])
            : (items || []).filter((i: KDSItem) => matchesStation(i, s.id));
          const sPending = sItems.filter((i: KDSItem) => i.kds_status === 'pending').length;
          return (
            <button
              key={s.id}
              onClick={() => switchStation(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                station === s.id
                  ? 'bg-amber-500 text-slate-900 border-amber-500'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-500 hover:text-slate-900 dark:text-white',
              )}
            >
              <span>{s.icon}</span>
              {s.label}
              {sPending > 0 && (
                <span className={cn(
                  'text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold',
                  station === s.id ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400' : 'bg-red-600 text-slate-900 dark:text-white',
                )}>
                  {sPending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tickets */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
          <CheckCircle size={52} className="opacity-30" />
          <p className="text-lg font-medium text-slate-900 dark:text-slate-400">
            {station === 'all'
              ? 'All clear! Kitchen is caught up.'
              : `No pending tickets for ${STATIONS.find((s) => s.id === station)?.label}.`}
          </p>
          <p className="text-sm text-slate-900 dark:text-slate-500">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {(Object.entries(grouped) as [string, KDSItem[]][]).map(([orderNum, tickets]) => (
              <TicketCard
                key={orderNum}
                orderNum={orderNum}
                tickets={tickets}
                onStartCooking={startCooking}
                onMarkReady={markReady}
                onBump={bump}
                isBumping={tickets.some((t) => bumping.has(t.order_item_id))}
                isMarkingReady={tickets.some((t) => marking.has(t.order_item_id))}
                isStartingCooking={tickets.some((t) => starting.has(t.order_item_id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}