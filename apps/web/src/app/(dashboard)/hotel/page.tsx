'use client';
/**
 * Hotel Dashboard
 * ──────────────────────────────────────────────────────────────
 * • Occupancy stats bar (total rooms, occupied %, available, cleaning, maintenance)
 * • Visual room grid grouped by floor — click a room to see quick details
 * • Today's arrivals and departures panels
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Hotel, BedDouble, Users, ArrowRight, ArrowLeft,
  RefreshCw, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomSummary {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomType: { name: string; baseRate: number };
}

interface DashboardData {
  totalRooms: number;
  occupancyPct: number;
  roomsByStatus: Record<string, number>;
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
}

interface Reservation {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  numNights: number;
  status: string;
  primaryGuest: { name: string; phone: string };
  room: { roomNumber: string; roomType: { name: string } };
}

type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance' | 'out_of_order';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; dot: string }> = {
  available: { label: 'Available', color: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', dot: 'bg-emerald-500' },
  occupied: { label: 'Occupied', color: 'bg-blue-500/15    border-blue-500/40    text-blue-300', dot: 'bg-blue-500' },
  reserved: { label: 'Reserved', color: 'bg-amber-500/15   border-amber-500/40   text-amber-300', dot: 'bg-amber-500' },
  cleaning: { label: 'Cleaning', color: 'bg-violet-500/15  border-violet-500/40  text-violet-300', dot: 'bg-violet-500' },
  maintenance: { label: 'Maintenance', color: 'bg-orange-500/15  border-orange-500/40  text-orange-300', dot: 'bg-orange-500' },
  out_of_order: { label: 'Out of Order', color: 'bg-red-500/15     border-red-500/40     text-red-300', dot: 'bg-red-500' },
};

// ─── Room card ────────────────────────────────────────────────────────────────

function RoomCard({ room, onClick }: { room: RoomSummary; onClick: () => void }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-100',
        cfg.color,
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-bold">{room.roomNumber}</span>
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
      </div>
      <div className="text-[10px] opacity-70 truncate w-full">{room.roomType?.name ?? '—'}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{cfg.label}</div>
    </button>
  );
}

// ─── Room detail popover ──────────────────────────────────────────────────────

function RoomDetail({ room, onClose }: { room: RoomSummary; onClose: () => void }) {
  const cfg = STATUS_CONFIG[room.status];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-xs space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold text-white">Room {room.roomNumber}</div>
            <div className="text-sm text-slate-400">{room.roomType?.name} · Floor {room.floor}</div>
          </div>
          <span className={cn('text-xs px-2 py-1 rounded-lg border font-medium', cfg.color)}>{cfg.label}</span>
        </div>
        <div className="text-sm text-slate-400">
          Base rate: <span className="text-white font-semibold">₹{Number(room.roomType?.baseRate ?? 0).toLocaleString('en-IN')}/night</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/hotel/reservations?roomId=${room.id}&roomNumber=${room.roomNumber}`}
            className="flex-1 btn-primary text-xs text-center py-2"
            onClick={onClose}
          >
            New Reservation
          </Link>
          <button onClick={onClose} className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HotelPage() {
  const [selectedRoom, setSelectedRoom] = useState<RoomSummary | null>(null);

  const { data: dash, isLoading: dashLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['hotel-dashboard'],
    queryFn: () => api.get('/api/v1/hotel/dashboard').then((r) => {
      const d = r.data;
      // Unwrap { data: ... } wrapper if present
      if (d && typeof d === 'object' && 'data' in d && !('totalRooms' in d)) return d.data;
      return d;
    }),
    staleTime: 60_000,
  });

  const { data: roomsData } = useQuery<RoomSummary[]>({
    queryKey: ['hotel-rooms'],
    queryFn: () => api.get('/api/v1/hotel/rooms').then((r) => {
      const d = r.data;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    }),
    staleTime: 30_000,
  });

  const { data: arrivals = [] } = useQuery<Reservation[]>({
    queryKey: ['hotel-arrivals'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/hotel/reservations?status=confirmed&from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&limit=10`);
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (d?.data && Array.isArray(d.data)) return d.data;
      if (d?.data?.data && Array.isArray(d.data.data)) return d.data.data;
      return [];
    },
    staleTime: 60_000,
  });

  const { data: departures = [] } = useQuery<Reservation[]>({
    queryKey: ['hotel-departures'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/hotel/reservations?status=checked_in&to=${new Date().toISOString().split('T')[0]}&limit=10`);
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (d?.data && Array.isArray(d.data)) return d.data;
      if (d?.data?.data && Array.isArray(d.data.data)) return d.data.data;
      return [];
    },
    staleTime: 60_000,
  });

  // Group rooms by floor — ensure rooms is always an array
  const rooms: RoomSummary[] = Array.isArray(roomsData) ? roomsData : [];
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const byFloor = (floor: number) => rooms.filter((r) => r.floor === floor);
  if (dashLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-800" />
          ))}
        </div>

        <div className="h-64 rounded-xl bg-slate-800" />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-40 rounded-xl bg-slate-800" />
          <div className="h-40 rounded-xl bg-slate-800" />
        </div>
      </div>
    );
  }

  const stats = dash ?? { totalRooms: 0, occupancyPct: 0, roomsByStatus: {}, arrivalsToday: 0, departuresToday: 0, inHouse: 0 };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Hotel size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Hotel</h1>
            <p className="text-xs text-slate-500">Front desk overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <RefreshCw size={13} />
          </button>
          <Link href="/hotel/reservations" className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} /> New Reservation
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Rooms', value: stats.totalRooms, color: 'text-slate-300' },
            { label: 'Occupancy', value: `${stats.occupancyPct}%`, color: 'text-blue-400' },
            { label: 'In House', value: stats.inHouse, color: 'text-blue-400' },
            { label: 'Arrivals Today', value: stats.arrivalsToday, color: 'text-amber-400' },
            { label: 'Departures', value: stats.departuresToday, color: 'text-violet-400' },
            { label: 'Available', value: stats.roomsByStatus?.available ?? 0, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <div className={cn('text-2xl font-bold tabular-nums', color)}>{value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Status legend ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [RoomStatus, typeof STATUS_CONFIG[RoomStatus]][]).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
              {cfg.label} ({stats.roomsByStatus?.[status] ?? 0})
            </div>
          ))}
        </div>

        {/* ── Room grid ─────────────────────────────────────────────────── */}
        {rooms.length === 0 ? (
          <div className="card text-center py-12 space-y-3">
            <BedDouble size={36} className="text-slate-700 mx-auto" />
            <p className="text-slate-500 text-sm">No rooms configured yet.</p>
            <Link href="/hotel/reservations" className="btn-primary text-xs inline-block">
              Set up rooms first
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {floors.map((floor) => (
              <div key={floor}>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Floor {floor}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {byFloor(floor).map((room) => (
                    <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Arrivals + Departures ──────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Arrivals */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ArrowRight size={14} className="text-amber-400" />
                Today's Arrivals ({arrivals.length})
              </div>
              <Link href="/hotel/reservations?status=confirmed" className="text-xs text-slate-500 hover:text-slate-300">
                View all
              </Link>
            </div>
            {arrivals.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">No arrivals today</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {arrivals.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{r.primaryGuest?.name}</div>
                      <div className="text-xs text-slate-500">
                        {r.room?.roomNumber} · {r.numNights}N · {r.room?.roomType?.name}
                      </div>
                    </div>
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-md flex-shrink-0">
                      {r.room?.roomNumber}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Departures */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ArrowLeft size={14} className="text-violet-400" />
                Today's Departures ({departures.length})
              </div>
              <Link href="/hotel/reservations?status=checked_in" className="text-xs text-slate-500 hover:text-slate-300">
                View all
              </Link>
            </div>
            {departures.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">No departures today</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {departures.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{r.primaryGuest?.name}</div>
                      <div className="text-xs text-slate-500">{r.room?.roomNumber} · Check-out today</div>
                    </div>
                    <Link
                      href={`/hotel/reservations?id=${r.id}`}
                      className="text-xs bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-md flex-shrink-0 hover:bg-violet-500/25"
                    >
                      Check out
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Room detail popover */}
      {selectedRoom && (
        <RoomDetail room={selectedRoom} onClose={() => setSelectedRoom(null)} />
      )}
    </div>
  );
}
