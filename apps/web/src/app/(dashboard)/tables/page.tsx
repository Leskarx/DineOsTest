'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Edit2, Trash2, Users, CheckCircle,
  Clock, Sparkles, LayoutGrid, Layers, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Status visuals ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  available: { bg: 'bg-emerald-900/20 border-emerald-700', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  occupied:  { bg: 'bg-red-900/20 border-red-700',         text: 'text-red-300',     dot: 'bg-red-500' },
  reserved:  { bg: 'bg-amber-900/20 border-amber-700',     text: 'text-amber-300',   dot: 'bg-amber-500' },
  cleaning:  { bg: 'bg-slate-800 border-slate-700',        text: 'text-slate-400',   dot: 'bg-slate-500' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  available: <CheckCircle size={14} />,
  occupied:  <Users size={14} />,
  reserved:  <Clock size={14} />,
  cleaning:  <Sparkles size={14} />,
};

const STATUSES = ['available', 'occupied', 'reserved', 'cleaning'];

type PageTab = 'floor' | 'sections';

export default function TablesPage() {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState<PageTab>('floor');
  const [filterSection, setFilterSection] = useState<string | null>(null);

  // Table form
  const [showTableForm, setShowTableForm] = useState(false);
  const [editTable, setEditTable]         = useState<any>(null);
  const [tableForm, setTableForm] = useState({ name: '', capacity: 4, sectionId: '' });

  // Section form
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editSection, setEditSection]         = useState<any>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', description: '', sortOrder: '' });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => apiFetch('/api/v1/tables').then((r) => r.data),
  });

  const { data: sections } = useQuery({
    queryKey: ['tableSections'],
    queryFn: () => apiFetch('/api/v1/tables/sections').then((r) => r.data),
  });

  // ── Table mutations ────────────────────────────────────────────────────────
  const saveTableMutation = useMutation({
    mutationFn: () =>
      editTable
        ? apiPut(`/api/v1/tables/${editTable.id}`, tableForm)
        : apiPost('/api/v1/tables', tableForm),
    onSuccess: () => {
      toast.success(editTable ? 'Table updated' : 'Table created');
      qc.invalidateQueries({ queryKey: ['tables'] });
      setShowTableForm(false);
      setEditTable(null);
      setTableForm({ name: '', capacity: 4, sectionId: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save table'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPut(`/api/v1/tables/${id}`, { status }),
    onSuccess: (_data, { status }) => {
      toast.success(`Table marked as ${status}`);
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update table status'),
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/tables/${id}`),
    onSuccess: () => { toast.success('Table removed successfully'); qc.invalidateQueries({ queryKey: ['tables'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to delete table'),
  });

  // ── Section mutations ──────────────────────────────────────────────────────
  const saveSectionMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...sectionForm,
        sortOrder: sectionForm.sortOrder ? parseInt(sectionForm.sortOrder) : undefined,
      };
      return editSection
        ? apiPut(`/api/v1/tables/sections/${editSection.id}`, payload)
        : apiPost('/api/v1/tables/sections', payload);
    },
    onSuccess: () => {
      toast.success(editSection ? 'Section updated' : 'Section created');
      qc.invalidateQueries({ queryKey: ['tableSections'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      setShowSectionForm(false);
      setEditSection(null);
      setSectionForm({ name: '', description: '', sortOrder: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to save section'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/tables/sections/${id}`),
    onSuccess: () => {
      toast.success('Section removed');
      qc.invalidateQueries({ queryKey: ['tableSections'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Section not empty — move tables first'),
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const visibleTables = (tables || []).filter((t: any) =>
    !filterSection || t.sectionId === filterSection,
  );

  const sectionMap: Record<string, string> = Object.fromEntries(
    (sections || []).map((s: any) => [s.id, s.name]),
  );

  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, (tables || []).filter((t: any) => t.status === s).length]),
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openCreateTable() {
    setEditTable(null);
    setTableForm({ name: '', capacity: 4, sectionId: filterSection || '' });
    setShowTableForm(true);
  }
  function openEditTable(t: any) {
    setEditTable(t);
    setTableForm({ name: t.name, capacity: t.capacity, sectionId: t.sectionId || '' });
    setShowTableForm(true);
  }
  function openCreateSection() {
    setEditSection(null);
    setSectionForm({ name: '', description: '', sortOrder: String((sections?.length || 0) + 1) });
    setShowSectionForm(true);
  }
  function openEditSection(s: any) {
    setEditSection(s);
    setSectionForm({ name: s.name, description: s.description || '', sortOrder: String(s.sortOrder || '') });
    setShowSectionForm(true);
  }

  return (
    <div className="p-6 space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Table Management</h1>
          <p className="text-sm text-slate-400">{tables?.length || 0} tables · {sections?.length || 0} sections</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Page tabs */}
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setPageTab('floor')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', pageTab === 'floor' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white')}
            >
              <LayoutGrid size={14} /> Floor Plan
            </button>
            <button
              onClick={() => setPageTab('sections')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', pageTab === 'sections' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white')}
            >
              <Layers size={14} /> Sections
            </button>
          </div>

          {pageTab === 'floor' && (
            <button onClick={openCreateTable} className="btn-primary">
              <Plus size={14} /> Add Table
            </button>
          )}
          {pageTab === 'sections' && (
            <button onClick={openCreateSection} className="btn-primary">
              <Plus size={14} /> Add Section
            </button>
          )}
        </div>
      </div>

      {/* ── Floor plan tab ──────────────────────────────────────────────── */}
      {pageTab === 'floor' && (
        <>
          {/* Status summary */}
          <div className="grid grid-cols-4 gap-3">
            {STATUSES.map((status) => {
              const styles = STATUS_COLORS[status];
              return (
                <div key={status} className={cn('card-sm border flex items-center gap-3', styles.bg)}>
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-black/20', styles.text)}>
                    {STATUS_ICONS[status]}
                  </span>
                  <div>
                    <div className={cn('text-lg font-bold', styles.text)}>{statusCounts[status] || 0}</div>
                    <div className="text-xs text-slate-500 capitalize">{status}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section filter strip */}
          {(sections?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Filter:</span>
              <button
                onClick={() => setFilterSection(null)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-colors', !filterSection ? 'bg-amber-500 text-slate-900 border-amber-500' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
              >
                All sections
              </button>
              {sections?.map((sec: any) => (
                <button
                  key={sec.id}
                  onClick={() => setFilterSection(filterSection === sec.id ? null : sec.id)}
                  className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-colors', filterSection === sec.id ? 'bg-amber-500 text-slate-900 border-amber-500' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          )}

          {/* Tables grid */}
          {tablesLoading ? (
            <div className="text-slate-400 text-sm">Loading tables…</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {visibleTables.map((table: any) => {
                const styles = STATUS_COLORS[table.status] || STATUS_COLORS.available;
                return (
                  <div key={table.id} className={cn('rounded-xl border-2 p-3 flex flex-col gap-2 transition-all', styles.bg)}>
                    <div className="flex items-center justify-between">
                      <span className={cn('font-bold text-sm truncate', styles.text)}>{table.name}</span>
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', styles.dot)} />
                    </div>
                    {table.sectionId && sectionMap[table.sectionId] && (
                      <div className="text-xs text-slate-500 truncate">{sectionMap[table.sectionId]}</div>
                    )}
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Users size={10} /> {table.capacity}
                    </div>
                    <select
                      value={table.status}
                      onChange={(e) => statusMutation.mutate({ id: table.id, status: e.target.value })}
                      className="text-xs bg-black/20 border border-white/10 rounded px-1 py-0.5 text-slate-300 w-full"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditTable(table)}
                        className="flex-1 text-xs py-1 rounded bg-black/20 hover:bg-black/30 text-slate-400"
                      >
                        <Edit2 size={10} className="inline" />
                      </button>
                      <button
                        onClick={() => {
                          if (table.status === 'occupied') {
                            toast.error(`Cannot delete "${table.name}" — table is currently occupied`);
                            return;
                          }
                          toast((t) => (
                            <div className="flex flex-col gap-2">
                              <span className="font-medium">Delete table &quot;{table.name}&quot;?</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { toast.dismiss(t.id); deleteTableMutation.mutate(table.id); }}
                                  className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => toast.dismiss(t.id)}
                                  className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ), { duration: 10000 });
                        }}
                        className="flex-1 text-xs py-1 rounded bg-black/20 hover:bg-red-900/30 text-red-400"
                      >
                        <Trash2 size={10} className="inline" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {visibleTables.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500">
                  No tables{filterSection ? ' in this section' : ''}.{' '}
                  <button onClick={openCreateTable} className="underline hover:text-slate-300">Add one</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Sections tab ────────────────────────────────────────────────── */}
      {pageTab === 'sections' && (
        <div className="space-y-3">
          {(!sections || sections.length === 0) && (
            <div className="text-center py-16 text-slate-500">
              <Layers size={40} className="mx-auto mb-3 opacity-30" />
              <p>No sections yet. Sections let you group tables by floor, area or room.</p>
              <button onClick={openCreateSection} className="btn-primary mt-4">
                <Plus size={14} /> Create First Section
              </button>
            </div>
          )}

          {sections?.map((sec: any) => {
            const sectionTables = (tables || []).filter((t: any) => t.sectionId === sec.id);
            return (
              <div key={sec.id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <Layers size={18} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{sec.name}</div>
                  {sec.description && <div className="text-xs text-slate-500 mt-0.5">{sec.description}</div>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400">{sectionTables.length} tables</span>
                    {sectionTables.length > 0 && (
                      <span className="text-xs text-emerald-400">
                        {sectionTables.filter((t: any) => t.status === 'available').length} available
                      </span>
                    )}
                    {sectionTables.filter((t: any) => t.status === 'occupied').length > 0 && (
                      <span className="text-xs text-red-400">
                        {sectionTables.filter((t: any) => t.status === 'occupied').length} occupied
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-600">Sort: {sec.sortOrder ?? '—'}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditSection(sec)} className="btn-ghost p-1.5">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (sectionTables.length > 0) {
                        toast.error(`Cannot delete "${sec.name}" — move all ${sectionTables.length} table(s) to another section first`);
                        return;
                      }
                      toast((t) => (
                        <div className="flex flex-col gap-2">
                          <span className="font-medium">Delete section &quot;{sec.name}&quot;?</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { toast.dismiss(t.id); deleteSectionMutation.mutate(sec.id); }}
                              className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => toast.dismiss(t.id)}
                              className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ), { duration: 10000 });
                    }}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table form modal ────────────────────────────────────────────── */}
      {showTableForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">{editTable ? 'Edit Table' : 'Add Table'}</h3>
              <button onClick={() => setShowTableForm(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div>
              <label className="label">Table Name / Number *</label>
              <input
                className="input"
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                placeholder="T1, Table 1, Terrace-A…"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Capacity (seats)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: +e.target.value })}
              />
            </div>
            <div>
              <label className="label">Section</label>
              <select
                className="input"
                value={tableForm.sectionId}
                onChange={(e) => setTableForm({ ...tableForm, sectionId: e.target.value })}
              >
                <option value="">— No section —</option>
                {sections?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {(!sections || sections.length === 0) && (
                <p className="text-xs text-slate-500 mt-1">
                  <button
                    type="button"
                    onClick={() => { setShowTableForm(false); setPageTab('sections'); openCreateSection(); }}
                    className="underline hover:text-slate-400"
                  >
                    Create a section first
                  </button>{' '}
                  to organise tables by floor or area.
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowTableForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => {
                  if (!tableForm.sectionId) {
                    toast.error('Please select a section before saving');
                    return;
                  }
                  saveTableMutation.mutate();
                }}
                disabled={saveTableMutation.isPending || !tableForm.name}
                className="btn-primary flex-1"
              >
                {saveTableMutation.isPending ? 'Saving…' : 'Save Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section form modal ───────────────────────────────────────────── */}
      {showSectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">{editSection ? 'Edit Section' : 'Add Section'}</h3>
              <button onClick={() => setShowSectionForm(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div>
              <label className="label">Section Name *</label>
              <input
                className="input"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="Ground Floor, Rooftop, Private Room…"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                placeholder="Optional note about this area"
              />
            </div>
            <div>
              <label className="label">Sort Order</label>
              <input
                className="input"
                type="number"
                min={1}
                value={sectionForm.sortOrder}
                onChange={(e) => setSectionForm({ ...sectionForm, sortOrder: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowSectionForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => saveSectionMutation.mutate()}
                disabled={saveSectionMutation.isPending || !sectionForm.name}
                className="btn-primary flex-1"
              >
                {saveSectionMutation.isPending ? 'Saving…' : 'Save Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
