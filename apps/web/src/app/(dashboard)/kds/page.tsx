'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPatch } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import {
  CheckCircle, RefreshCw, Clock, ChefHat,
  AlertCircle, Volume2, VolumeX, FlameKindling, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ─── Audio beep with proper cleanup ───────────────────────────────────────────────
let audioContext: AudioContext | null = null;

function playBeep(frequency = 880, duration = 0.18, volume = 0.4) {
  if (typeof window === 'undefined') return;
  
  try {
    // Reuse or create audio context (resume if suspended)
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume if suspended (browser autoplay policies)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
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
    
    osc.onended = () => {
      // Don't close context, just let it idle
    };
  } catch (error) {
    console.warn('Audio playback failed:', error);
  }
}

// ─── Station definitions ─────────────────────────────────────────────────────
const STATIONS = [
  { id: 'all', label: 'All Stations', icon: '📋', keywords: [] },
  { id: 'hot', label: 'Hot Kitchen', icon: '🔥', keywords: ['starter', 'main', 'curry', 'grill', 'tandoor', 'soup', 'rice', 'tikka', 'dal', 'chicken', 'mutton', 'fish', 'bread', 'roti', 'naan', 'paneer'] },
  { id: 'cold', label: 'Cold Section', icon: '🧊', keywords: ['salad', 'raita', 'cold', 'yogurt', 'lassi', 'shake', 'ice', 'dessert', 'sweet', 'gulab', 'kheer', 'halwa'] },
  { id: 'bar', label: 'Bar / Beverages', icon: '🥤', keywords: ['beer', 'wine', 'whisky', 'rum', 'gin', 'vodka', 'cocktail', 'mocktail', 'juice', 'soda', 'water', 'beverage', 'drink', 'lime', 'mango lassi'] },
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

// Type definitions
interface KDSItem {
  order_item_id: string;
  order_order_number: string;
  item_name: string;
  category_name?: string;
  quantity: number;
  notes?: string;
  kds_status: 'pending' | 'preparing' | 'ready';
  age_seconds: number;
  order_type?: string;
  table_name?: string;
}

export default function KdsPage() {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [station, setStation] = useState<StationId>('all');
  const [isSwitchingStation, setIsSwitchingStation] = useState(false);
  const prevPendingCountRef = useRef<number | null>(null);
  const audioInitializedRef = useRef(false);
  const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(() => {
    if (!audioInitializedRef.current && audioContext) {
      audioContext.resume().catch(console.warn);
      audioInitializedRef.current = true;
    }
  }, []);

  // Persist station choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATION_STORAGE_KEY) as StationId | null;
      if (saved && STATIONS.find((s) => s.id === saved)) {
        setStation(saved);
      }
    } catch (error) {
      console.warn('Failed to load station preference:', error);
    }
  }, []);

  const switchStation = useCallback((s: StationId) => {
    if (s === station) return;
    setIsSwitchingStation(true);
    setStation(s);
    try {
      localStorage.setItem(STATION_STORAGE_KEY, s);
    } catch (error) {
      console.warn('Failed to save station preference:', error);
    }
    // Clear any existing timeout
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }
    // Hide loading after a short delay (or when data loads)
    switchTimeoutRef.current = setTimeout(() => {
      setIsSwitchingStation(false);
    }, 300);
  }, [station]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, []);

  // Tick every 10 seconds to refresh age display
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Add click listener to initialize audio
  useEffect(() => {
    document.body.addEventListener('click', initAudio);
    return () => document.body.removeEventListener('click', initAudio);
  }, [initAudio]);

  const { 
    data: items, 
    refetch,
    isLoading,
    error 
  } = useQuery({
    queryKey: ['kds-pending'],
    queryFn: () => apiFetch('/api/v1/kds/pending').then((r) => r.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Hide loading when data is available after station switch
  useEffect(() => {
    if (items && isSwitchingStation) {
      setTimeout(() => setIsSwitchingStation(false), 100);
    }
  }, [items, isSwitchingStation]);

  // Audio on new pending items
  useEffect(() => {
    if (!items || !Array.isArray(items)) return;
    
    const stationItems = station === 'all' 
      ? items 
      : items.filter((i: KDSItem) => matchesStation(i, station));
    
    const pendingCount = stationItems.filter((i: KDSItem) => i.kds_status === 'pending').length;
    
    if (prevPendingCountRef.current !== null && 
        pendingCount > prevPendingCountRef.current && 
        soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
    
    prevPendingCountRef.current = pendingCount;
  }, [items, soundOn, station]);

  const handleNewOrder = useCallback(() => {
    refetch();
    if (soundOn) {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1100, 0.15), 220);
    }
  }, [refetch, soundOn]);

  // Socket event handlers
  useSocket('order:created', handleNewOrder);
  useSocket('order:itemsAdded', handleNewOrder);
  useSocket('order:statusChanged', () => refetch());
  useSocket('kds:itemStatusChanged', () => refetch());

  const bumpMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/v1/kds/items/${id}/bump`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kds-items'] });
    },
    onError: (error) => {
      console.error('Failed to bump item:', error);
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiPatch(`/api/v1/kds/items/${id}/status`, { status: 'ready' })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kds-items'] });
    },
    onError: (error) => {
      console.error('Failed to mark ready:', error);
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiPatch(`/api/v1/kds/items/${id}/status`, { status: 'preparing' })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kds-items'] });
    },
    onError: (error) => {
      console.error('Failed to acknowledge item:', error);
    },
  });

  // Filter items to the active station, then group by order
  const filteredItems = (items && Array.isArray(items) ? items : []).filter((i: KDSItem) => 
    matchesStation(i, station)
  );

  const groupedByOrder = filteredItems.reduce((acc: Record<string, KDSItem[]>, item: KDSItem) => {
    const key = item.order_order_number || item.order_item_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const readyCount = filteredItems.filter((i: KDSItem) => i.kds_status === 'ready').length;
  const pendingCount = filteredItems.filter((i: KDSItem) => i.kds_status === 'pending').length;

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="animate-pulse text-amber-400 mx-auto mb-4" size={48} />
          <p className="text-slate-400">Loading kitchen display...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <p className="text-red-400 font-semibold mb-2">Failed to load orders</p>
          <p className="text-slate-400 text-sm mb-4">
            There was an error loading the kitchen display. Please try again.
          </p>
          <button onClick={() => refetch()} className="btn-primary">
            <RefreshCw size={16} className="mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 flex flex-col">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-amber-400" />
          <h1 className="text-lg font-bold text-white">Kitchen Display</h1>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs font-medium">
              {Object.keys(groupedByOrder).length} active
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-medium">
                {pendingCount} pending
              </span>
            )}
            {readyCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-medium">
                {readyCount} ready
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <button
              onClick={() => {
                const readyItems = filteredItems.filter((i: KDSItem) => i.kds_status === 'ready');
                Promise.all(readyItems.map((i: KDSItem) => bumpMutation.mutate(i.order_item_id)));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <CheckCircle size={12} /> 
              Bump All ({readyCount})
            </button>
          )}
          <button
            onClick={() => setSoundOn((s) => !s)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              soundOn 
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
            title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundOn ? 'Mute' : 'Unmute'}
          </button>
          <button 
            onClick={() => refetch()} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
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
            : (items || []).filter((i: KDSItem) => matchesStation(i, s.id));
          const stationPending = stationItems.filter((i: KDSItem) => i.kds_status === 'pending').length;

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
                  'text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold',
                  station === s.id ? 'bg-slate-900 text-amber-400' : 'bg-red-600 text-white',
                )}>
                  {stationPending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tickets grid with station switching loading state ─────────────────── */}
      {isSwitchingStation ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-amber-400" size={48} />
          <p className="text-slate-400 text-sm">
            Loading {STATIONS.find((s) => s.id === station)?.label}...
          </p>
        </div>
      ) : Object.keys(groupedByOrder).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
          <CheckCircle size={52} className="opacity-30" />
          <p className="text-lg font-medium text-slate-400">
            {station === 'all'
              ? 'All clear! Kitchen is caught up.'
              : `No pending tickets for ${STATIONS.find((s) => s.id === station)?.label}.`}
          </p>
          <p className="text-sm text-slate-500">
            New orders will appear here automatically
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {(Object.entries(groupedByOrder) as [string, KDSItem[]][]).map(([orderNum, tickets]) => {
              const unfulfilled = tickets.filter((t) => t.kds_status === 'pending' || t.kds_status === 'preparing' || t.kds_status === 'acknowledged');
              // Use oldest unfulfilled item if exists, otherwise oldest item overall. Since array is DESC, last item is oldest.
              const oldest = unfulfilled.length > 0 ? unfulfilled[unfulfilled.length - 1] : tickets[tickets.length - 1];
              const ageSeconds = oldest?.age_seconds || 0;
              const isUrgent = ageSeconds > KDS_URGENT_SECONDS;
              const allReady = tickets.every((t) => t.kds_status === 'ready');
              const anyReady = tickets.some((t) => t.kds_status === 'ready');
              const anyPending = tickets.some((t) => t.kds_status === 'pending');

              return (
                <div
                  key={orderNum}
                  className={cn(
                    'bg-slate-900 rounded-2xl border shadow-lg overflow-hidden flex flex-col min-h-[280px] transition-all',
                    'border-slate-700',
                    allReady && 'border-emerald-500/70 ring-1 ring-emerald-500/30',
                    !allReady && anyReady && 'border-amber-500/70',
                    !anyReady && anyPending && 'border-orange-500/70',
                    isUrgent && 'ring-2 ring-red-500/60 animate-pulse'
                  )}
                >
                  {/* Header */}
                  <div className="px-5 py-4 bg-slate-800 border-b border-slate-700 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold text-white text-lg truncate">
                        #{oldest?.order_order_number || orderNum}
                      </h2>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                        <span className="capitalize">
                          {oldest?.order_type?.replace('_', ' ') || 'dine in'}
                        </span>
                        {oldest?.table_name && (
                          <>
                            <span>•</span>
                            <span>Table {oldest.table_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-sm flex-shrink-0 ml-3">
                      {isUrgent && <AlertCircle size={16} className="text-red-400" />}
                      <Clock size={14} className={isUrgent ? 'text-red-400' : 'text-slate-400'} />
                      <span className={cn('font-semibold', isUrgent ? 'text-red-400' : 'text-slate-400')}>
                        {Math.floor(ageSeconds / 60)}m {ageSeconds % 60}s
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                    {tickets.map((ticket: KDSItem) => (
                      <div
                        key={ticket.order_item_id}
                        className={cn(
                          'rounded-xl bg-slate-800/70 border p-3 flex items-start gap-3 transition-opacity',
                          ticket.kds_status === 'ready' && 'opacity-60',
                          ticket.kds_status === 'pending' && 'border-amber-500/30 bg-amber-500/5',
                          ticket.kds_status === 'preparing' && 'border-blue-500/30 bg-blue-500/5'
                        )}
                      >
                        {/* Qty */}
                        <div className="min-w-[52px] h-12 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
                          {parseInt(String(ticket.quantity))}×
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base leading-snug break-words">
                            {ticket.item_name}
                          </p>
                          {ticket.notes && (
                            <div className="mt-2 inline-flex rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1">
                              <span className="text-red-300 text-xs font-medium">
                                📝 {ticket.notes}
                              </span>
                            </div>
                          )}
                          {ticket.kds_status === 'preparing' && (
                            <div className="mt-2 inline-flex items-center gap-1">
                              <span className="text-xs text-blue-400">👨‍🍳 Cooking...</span>
                            </div>
                          )}
                        </div>

                        {/* Status Icon */}
                        {ticket.kds_status === 'ready' && (
                          <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions */}
                  {!allReady ? (
                    <div className="p-4 border-t border-slate-700 bg-slate-900/70">
                      <div className="grid grid-cols-2 gap-3">
                        {anyPending && (
                          <button
                            onClick={() => {
                              const pendingItems = tickets.filter((t) => t.kds_status === 'pending');
                              const ids = pendingItems.map((t) => t.order_item_id);
                              if (ids.length > 0) ackMutation.mutate(ids);
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-600 transition-all text-white font-medium py-2.5 px-3 text-sm"
                            disabled={ackMutation.isPending}
                          >
                            <ChefHat size={15} />
                            Start Cooking
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const ids = tickets
                              .filter((t) => t.kds_status !== 'ready' && t.kds_status !== 'completed')
                              .map((t) => t.order_item_id);
                            if (ids.length > 0) markReadyMutation.mutate(ids);
                          }}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 transition-all text-slate-950 font-bold py-2.5 px-3 text-sm',
                            !anyPending && 'col-span-2'
                          )}
                          disabled={markReadyMutation.isPending}
                        >
                          <CheckCircle size={15} />
                          Mark Ready
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-t border-slate-700 bg-emerald-500/10 flex items-center justify-center gap-2 text-emerald-400 font-medium">
                      <CheckCircle size={18} />
                      Waiting for pickup
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}