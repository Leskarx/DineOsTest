'use client';
/**
 * Hotel Housekeeping
 * ──────────────────────────────────────────────────────────────
 * • Board view: tasks grouped by status (Pending / In Progress / Done)
 * • Each card shows room number, task type, priority badge, notes
 * • Inline status transitions with optimistic updates
 * • Date selector to view any day's tasks
 * • Create new task modal
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  SprayCan, Wrench, ChevronRight, ChevronDown, RefreshCw,
  Plus, Clock, AlertTriangle, Zap, CheckCircle2, Loader2,
  CalendarDays, X, BedDouble,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type HkStatus = 'pending' | 'in_progress' | 'done' | 'skipped';
type HkPriority = 'normal' | 'high' | 'urgent';
type HkTaskType = 'checkout_clean' | 'stayover' | 'turndown' | 'inspection' | 'maintenance';

interface HkTask {
  id: string;
  roomId: string;
  status: HkStatus;
  priority: HkPriority;
  taskType: HkTaskType;
  notes?: string;
  scheduledFor: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  room?: {
    roomNumber: string;
    floor: number;
    roomType?: { name: string };
  };
}

interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  roomType: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPE_CONFIG: Record<HkTaskType, { label: string; icon: React.ElementType; color: string }> = {
  checkout_clean: { label: 'Checkout Clean', icon: SprayCan, color: 'text-violet-400' },
  stayover: { label: 'Stayover', icon: BedDouble, color: 'text-blue-400' },
  turndown: { label: 'Turndown', icon: BedDouble, color: 'text-indigo-400' },
  inspection: { label: 'Inspection', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-orange-400' },
};

const PRIORITY_CONFIG: Record<HkPriority, { label: string; color: string; icon: React.ElementType }> = {
  normal: { label: 'Normal', color: 'bg-slate-200 dark:bg-slate-700/60 text-slate-900 dark:text-slate-400', icon: Clock },
  high: { label: 'High', color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: AlertTriangle },
  urgent: { label: 'Urgent', color: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: Zap },
};

const STATUS_COLUMNS: { status: HkStatus; label: string; nextStatus?: HkStatus; nextLabel?: string; color: string }[] = [
  { status: 'pending', label: 'Pending', nextStatus: 'in_progress', nextLabel: 'Start', color: 'border-slate-300 dark:border-slate-700' },
  { status: 'in_progress', label: 'In Progress', nextStatus: 'done', nextLabel: 'Mark Done', color: 'border-amber-400 dark:border-amber-500/40' },
  { status: 'done', label: 'Done', color: 'border-emerald-500/40' },
];

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  updating,
}: {
  task: HkTask;
  onStatusChange: (id: string, status: HkStatus) => void;
  updating: boolean;
}) {
  const taskCfg = TASK_TYPE_CONFIG[task.taskType] ?? TASK_TYPE_CONFIG.stayover;
  const priCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.normal;
  const PriIcon = priCfg.icon;
  const TaskIcon = taskCfg.icon;
  const col = STATUS_COLUMNS.find((c) => c.status === task.status);

  return (
    <div className={cn(
      'group bg-white dark:bg-slate-900 border rounded-xl p-3 space-y-3 transition-all duration-200',
      'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700',
      col?.color ?? 'border-slate-200 dark:border-slate-800',
      updating && 'opacity-60 pointer-events-none scale-[0.98]'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('p-1.5 rounded-lg flex-shrink-0 bg-slate-50 dark:bg-slate-800/50', taskCfg.color)}>
            <TaskIcon size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Room {task.room?.roomNumber ?? '—'}
            </span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Floor {task.room?.floor ?? '—'}</span>
          </div>
        </div>
        <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 border transition-colors', priCfg.color, 'border-current/10')}>
          <PriIcon size={10} />
          {priCfg.label}
        </span>
      </div>

      {/* Type + room type */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{taskCfg.label}</span>
        {task.room?.roomType?.name && (
          <>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[11px] text-slate-500 font-medium">{task.room.roomType.name}</span>
          </>
        )}
      </div>

      {/* Notes */}
      {task.notes && (
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/20 italic">
          "{task.notes}"
        </p>
      )}

      {/* Meta Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-col">
          {task.assignedTo && (
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">👤 {task.assignedTo}</span>
          )}
          {task.startedAt && (
            <span className="text-[10px] text-slate-500">
              {format(new Date(task.startedAt), 'h:mm a')}
              {task.completedAt && ` → ${format(new Date(task.completedAt), 'h:mm a')}`}
            </span>
          )}
        </div>
        
        {/* Action button */}
        {col?.nextStatus && (
          <button
            onClick={() => onStatusChange(task.id, col.nextStatus!)}
            disabled={updating}
            className={cn(
              "flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all",
              "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm",
              "hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white group-hover:border-slate-300 dark:group-hover:border-slate-600",
              updating ? "text-slate-400" : "text-slate-600 dark:text-slate-300"
            )}
          >
            {updating ? <Loader2 size={12} className="animate-spin" /> : col.nextLabel}
            {!updating && <ChevronRight size={12} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />}
          </button>
        )}
      </div>
    </div>
  );
}

function HousekeepingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 h-full divide-x divide-slate-200 dark:divide-slate-800">
      {[1, 2, 3].map((col) => (
        <div key={col} className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-5 w-6 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {[1, 2].map((card) => (
              <div key={card} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-2 w-10 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                </div>
                <div className="h-8 w-full bg-slate-50 dark:bg-slate-800/40 rounded-lg animate-pulse" />
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="h-2 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({ date, onClose }: { date: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['hotel-rooms-for-hk'],
    queryFn: async () => {
      const res = await api.get('/api/v1/hotel/rooms');

      console.log('ROOM RESPONSE:', res.data);

      const data = res.data;

      // direct array
      if (Array.isArray(data)) {
        return data;
      }

      // { rooms: [] }
      if (data && Array.isArray(data.rooms)) {
        return data.rooms;
      }

      // { data: [] }
      if (data && Array.isArray(data.data)) {
        return data.data;
      }

      // { data: { rooms: [] } }
      if (data?.data && Array.isArray(data.data.rooms)) {
        return data.data.rooms;
      }

      return [];
    },
    staleTime: 60_000,
  });

  const safeRooms = Array.isArray(rooms)
    ? rooms
    : [];

  const [form, setForm] = useState({
    roomId: '',
    taskType: 'stayover' as HkTaskType,
    priority: 'normal' as HkPriority,
    assignedTo: '',
    notes: '',
    scheduledFor: date,
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (body: typeof form) => api.post('/api/v1/hotel/housekeeping', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hotel-housekeeping', date] });
      onClose();
    },
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">New Task</h3>
          <button onClick={onClose} className="p-1 text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {/* Room */}
        <div className="space-y-1">
          <label className="text-xs text-slate-900 dark:text-slate-400">Room *</label>
          <select
            value={form.roomId}
            onChange={(e) => set('roomId', e.target.value)}
            className="input-field text-sm w-full"
          >
            <option value="">Select room…</option>
            {safeRooms.map((r) => (
              <option key={r.id} value={r.id}>Room {r.roomNumber} – {r.roomType?.name}</option>
            ))}
          </select>
        </div>

        {/* Task type + priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-900 dark:text-slate-400">Task Type</label>
            <select value={form.taskType} onChange={(e) => set('taskType', e.target.value as HkTaskType)} className="input-field text-sm w-full">
              {Object.entries(TASK_TYPE_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-900 dark:text-slate-400">Priority</label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value as HkPriority)} className="input-field text-sm w-full">
              {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1">
          <label className="text-xs text-slate-900 dark:text-slate-400">Scheduled For</label>
          <input
            type="date"
            value={form.scheduledFor}
            onChange={(e) => set('scheduledFor', e.target.value)}
            className="input-field text-sm w-full"
          />
        </div>

        {/* Assigned to */}
        <div className="space-y-1">
          <label className="text-xs text-slate-900 dark:text-slate-400">Assigned To</label>
          <input
            type="text"
            placeholder="Staff name (optional)"
            value={form.assignedTo}
            onChange={(e) => set('assignedTo', e.target.value)}
            className="input-field text-sm w-full"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs text-slate-900 dark:text-slate-400">Notes</label>
          <textarea
            rows={2}
            placeholder="Any special instructions…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="input-field text-sm w-full resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => create(form)}
            disabled={!form.roomId || isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create Task
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HousekeepingPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = user?.role !== 'housekeeping';
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showNew, setShowNew] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: tasks = [], isFetching, refetch } = useQuery<HkTask[]>({
    queryKey: ['hotel-housekeeping', date],
    queryFn: () => api.get(`/api/v1/hotel/housekeeping?date=${date}`).then((r) => {
      const d = r.data;
      // API may return raw array or wrapped { data: [...] }
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HkStatus }) =>
      api.patch(`/api/v1/hotel/housekeeping/${id}`, { status }).then((r) => r.data),
    onMutate: ({ id }) => setUpdatingId(id),
    onSettled: () => {
      setUpdatingId(null);
      qc.invalidateQueries({ queryKey: ['hotel-housekeeping', date] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-dashboard'] });
    },
  });

  const handleStatusChange = (id: string, status: HkStatus) => {
    updateStatus({ id, status });
  };

  // Count per status for column headers — guard against non-array edge cases
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const countFor = (s: HkStatus) => safeTasks.filter((t) => t.status === s).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <SprayCan size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">Housekeeping</h1>
            <p className="text-xs text-slate-900 dark:text-slate-500">Room cleaning & maintenance tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            <CalendarDays size={13} className="text-slate-900 dark:text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none text-sm text-slate-600 dark:text-slate-300 w-32"
            />
          </div>
          <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-400 transition-colors">
            <RefreshCw size={13} />
          </button>
          {canCreate && (
            <button onClick={() => setShowNew(true)} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={13} /> New Task
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/30 flex-shrink-0">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.status} className="flex items-center gap-1.5 text-xs">
            <span className={cn('w-2 h-2 rounded-full', {
              'bg-slate-500': col.status === 'pending',
              'bg-amber-500': col.status === 'in_progress',
              'bg-emerald-500': col.status === 'done',
            })} />
            <span className="text-slate-900 dark:text-slate-400">{col.label}</span>
            <span className="text-slate-900 dark:text-slate-500">({countFor(col.status)})</span>
          </div>
        ))}
        <span className="text-slate-700 text-xs ml-auto">{safeTasks.length} total tasks for {format(new Date(date + 'T12:00:00'), 'MMM d, yyyy')}</span>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {isFetching ? (
          <HousekeepingSkeleton />
        ) : safeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <CheckCircle2 size={40} />
            <p className="text-sm">No tasks scheduled for this day.</p>
            {canCreate && (
              <button onClick={() => setShowNew(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={12} /> Create a task
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 h-full divide-x divide-slate-200 dark:divide-slate-800">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = safeTasks.filter((t) => t.status === col.status);
              return (
                <div key={col.status} className="flex flex-col overflow-hidden">
                  {/* Column header */}
                  <div className={cn(
                    'flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800',
                    'bg-white dark:bg-slate-900/60',
                  )}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', {
                        'bg-slate-500': col.status === 'pending',
                        'bg-amber-500': col.status === 'in_progress',
                        'bg-emerald-500': col.status === 'done',
                      })} />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{col.label}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-900 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {colTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-700 gap-2">
                        <ChevronDown size={20} />
                        <span className="text-xs">No tasks here</span>
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          updating={updatingId === task.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNew && <NewTaskModal date={date} onClose={() => setShowNew(false)} />}
    </div>
  );
}
