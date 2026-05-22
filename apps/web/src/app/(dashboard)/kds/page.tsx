'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPatch } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  CheckCircle, RefreshCw, Clock, ChefHat,
  AlertCircle, Volume2, VolumeX, FlameKindling,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ─── Audio beep ───────────────────────────────────────────────────────────────
function playBeep(frequency = 880, duration = 0.18, volume = 0.4) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch { /* SSR / restricted env */ }
}

// ─── Station definitions ─────────────────────────────────────────────────────
/**
 * Each station matches items whose category or name contains one of the listed keywords.
 * "All" shows every ticket regardless.
 * Kitchens can set their station once and only see their own tickets.
 */
const STATIONS = [
  { id: 'all',  label: 'All Stations', icon: '📋', keywords: [] },
  { id: 'hot',  label: 'Hot Kitchen',  icon: '🔥', keywords: ['starter', 'main', 'curry', 'grill', 'tandoor', 'soup', 'rice', 'tikka', 'dal', 'chicken', 'mutton', 'fish', 'bread', 'roti', 'naan', 'paneer'] },
  { id: 'cold', label: 'Cold Section', icon: '🧊', keywords: ['salad', 'raita', 'cold', 'yogurt', 'lassi', 'shake', 'ice', 'dessert', 'sweet', 'gulab', 'kheer', 'halwa'] },
  { id: 'bar',  label: 'Bar / Beverages', icon: '🥤', keywords: ['beer', 'wine', 'whisky', 'rum', 'gin', 'vodka', 'cocktail', 'mocktail', 'juice', 'soda', 'water', 'beverage', 'drink', 'lime', 'mango lassi'] },
] as const;

type StationId = typeof STATIONS[number]['id'];

const STATION_STORAGE_KEY = 'dinestay:kds:station';

function matchesStation(ticket: any, stationId: StationId): boolean {
  if (stationId === 'all') return true;
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station || !station.keywords.length) return true;
  const haystack = `${ticket.item_name || ''} ${ticket.category_name || ''}`.toLowerCase();
  return station.keywords.some((kw) => haystack.includes(kw));
}

const KDS_URGENT_SECONDS = 600;

export default function KdsPage() {
  const qc  = useQueryClient();
  const [tick, setTick]       = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [station, setStation] = useState<StationId>('all');
  const prevCountRef = useRef<number | null>(null);

  // Persist station choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATION_STORAGE_KEY) as StationId | null;
      if (saved && STATIONS.find((s) => s.id === saved)) setStation(saved);
    } catch {}
  }, []);

  const switchStation = (s: StationId) => {
    setStation(s);
    try { localStorage.setItem(STATION_STORAGE_KEY, s); } catch {}
  };

  // Tick every 10 s to refresh age display
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const { data: items, refetch } = useQuery({
    queryKey: ['kds-pending'],
    queryFn: () => apiFetch('/api/v1/kds/pending').then((r) => r.data),
    refetchInterval: 15_000,
  });

  // Audio on new pending items
  useEffect(() => {
    if (!items) return;
    const all = items as any[];
    const stationItems = station === 'all' ? all : all.filter((i) => matchesStation(i, station));
    const pendingCount = stationItems.filter((i) => i.kds_status === 'pending').length;
    if (prevCountRef.current !== null && pendingCount > prevCountRef.current && soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
    prevCountRef.current = pendingCount;
  }, [items, soundOn, station]);

  const handleNewOrder = useCallback(() => {
    refetch();
    if (soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
  }, [refetch, soundOn]);

  useSocket('order:created',         handleNewOrder);
  useSocket('order:itemsAdded',      handleNewOrder);
  useSocket('kds:itemStatusChanged', () => refetch());

  const bumpMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/v1/kds/items/${id}/bump`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-pending'] }),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/v1/kds/items/${id}/status`, { status: 'preparing' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds-pending'] }),
  });

  // Filter items to the active station, then group by order
  const filteredItems = (items || []).filter((i: any) => matchesStation(i, station));

  const groupedByOrder = filteredItems.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.order_order_number || item.order_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const readyCount   = filteredItems.filter((i: any) => i.kds_status === 'ready').length;
  const pendingCount = filteredItems.filter((i: any) => i.kds_status === 'pending').length;

  return (
    <div className="h-full bg-slate-950 flex flex-col">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-amber-400" />
          <h1 className="text-lg font-bold text-white">Kitchen Display</h1>
          <div className="flex items-center gap-1.5">
            <span className="badge-yellow">{Object.keys(groupedByOrder).length} active</span>
            {pendingCount > 0 && <span className="badge-red">{pendingCount} pending</span>}
            {readyCount  > 0 && <span className="badge-green">{readyCount} ready</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <button
              onClick={() =>
                filteredItems
                  .filter((i: any) => i.kds_status === 'ready')
                  .forEach((i: any) => bumpMutation.mutate(i.order_item_id))
              }
              className="btn-primary text-xs py-1.5 px-3"
            >
              <CheckCircle size={12} /> Bump All Ready ({readyCount})
            </button>
          )}
          <button
            onClick={() => setSoundOn((s) => !s)}
            className={cn('btn-ghost text-xs', soundOn ? 'text-amber-400' : 'text-slate-500')}
            title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button onClick={() => refetch()} className="btn-ghost text-xs">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Station filter bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2 bg-slate-900/50 border-b border-slate-800 overflow-x-auto scrollbar-none">
        <span className="text-xs text-slate-500 font-medium mr-1 whitespace-nowrap flex items-center gap-1">
          <FlameKindling size={12} /> Station:
        </span>
        {STATIONS.map((s) => {
          const stationItems = s.id === 'all'
            ? (items || [])
            : (items || []).filter((i: any) => matchesStation(i, s.id));
          const stationPending = stationItems.filter((i: any) => i.kds_status === 'pending').length;

          return (
            <button
              key={s.id}
              onClick={() => switchStation(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                station === s.id
                  ? 'bg-amber-500 text-slate-900 border-amber-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white',
              )}
            >
              <span>{s.icon}</span>
              {s.label}
              {stationPending > 0 && (
                <span className={cn(
                  'text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold',
                  station === s.id ? 'bg-slate-900 text-amber-400' : 'bg-red-600 text-white',
                )}>
                  {stationPending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tickets grid ─────────────────────────────────────────────────── */}
      {Object.keys(groupedByOrder).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
          <CheckCircle size={48} className="opacity-30" />
          <p className="text-lg">
            {station === 'all' ? 'All clear! Kitchen is caught up.' : `No pending tickets for ${STATIONS.find((s) => s.id === station)?.label}.`}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {(Object.entries(groupedByOrder) as [string, any[]][]).map(([orderNum, tickets]) => {
            const oldest     = tickets[0];
            const ageSeconds = oldest?.age_seconds || 0;
            const isUrgent   = ageSeconds > KDS_URGENT_SECONDS;
            const allReady   = tickets.every((t) => t.kds_status === 'ready');
            const anyReady   = tickets.some((t)  => t.kds_status === 'ready');
            const anyPending = tickets.some((t)  => t.kds_status === 'pending');

            return (
              <div
                key={orderNum}
                className={cn(
                  'bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col',
                  allReady   && 'kds-ticket-ready',
                  !allReady && anyReady  && 'kds-ticket-preparing',
                  !anyReady && anyPending && 'kds-ticket-pending',
                  isUrgent   && 'kds-ticket-urgent',
                )}
              >
                {/* Ticket header */}
                <div className="px-4 py-3 bg-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm">
                      {oldest?.order_order_number || orderNum}
                    </div>
                    <div className="text-xs text-slate-400">
                      {oldest?.order_type?.replace('_', ' ')}
                      {oldest?.table_name ? ` • ${oldest.table_name}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {isUrgent && <AlertCircle size={14} className="text-red-400" />}
                    <Clock size={12} className={isUrgent ? 'text-red-400' : 'text-slate-400'} />
                    <span className={isUrgent ? 'text-red-400 font-bold' : 'text-slate-400'}>
                      {Math.floor(ageSeconds / 60)}m{ageSeconds % 60 > 0 ? `${ageSeconds % 60}s` : ''}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="flex-1 p-3 space-y-2">
                  {tickets.map((ticket: any) => (
                    <div
                      key={ticket.order_item_id}
                      className={cn(
                        'flex items-start gap-2 text-sm rounded-lg px-2 py-1.5',
                        ticket.kds_status === 'ready' && 'opacity-50 line-through',
                      )}
                    >
                      <span className="font-bold text-amber-400 w-6 flex-shrink-0">{ticket.quantity}×</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-medium leading-tight">{ticket.item_name}</span>
                        {ticket.notes && (
                          <p className="text-slate-400 text-xs mt-0.5 italic">** {ticket.notes} **</p>
                        )}
                      </div>
                      {ticket.kds_status === 'ready' && (
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="p-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  {anyPending && (
                    <button
                      onClick={() =>
                        tickets
                          .filter((t) => t.kds_status === 'pending')
                          .forEach((t) => ackMutation.mutate(t.order_item_id))
                      }
                      className="btn-secondary text-xs py-2"
                    >
                      <ChefHat size={12} /> Start
                    </button>
                  )}
                  <button
                    onClick={() => tickets.forEach((t) => bumpMutation.mutate(t.order_item_id))}
                    className={cn('btn-primary text-xs py-2', !anyPending && 'col-span-2')}
                  >
                    <CheckCircle size={12} /> Ready — Bump
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
