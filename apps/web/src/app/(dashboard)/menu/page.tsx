'use client';
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost, apiPut, apiDelete, api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  ImagePlus, X, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ItemForm {
  name: string;
  price: string;
  categoryId: string;
  isVeg: boolean;
  description: string;
  sku: string;
  gstRateId: string;
  imageUrl: string;
}

const EMPTY_FORM: ItemForm = {
  name: '', price: '', categoryId: '', isVeg: true,
  description: '', sku: '', gstRateId: '', imageUrl: '',
};

// ─── Image upload helper ───────────────────────────────────────────────────────
async function uploadMenuImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/api/v1/storage/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // Interceptor shape: { success, data: { url, key, ... } }
  const fullUrl: string = res.data?.data?.url ?? res.data?.url ?? '';
  // Normalise to a /static/… path so the Next.js proxy serves it correctly
  // regardless of the host the API stored in the URL.
  return normaliseImageUrl(fullUrl);
}

/**
 * Convert an absolute API static URL (http://localhost:4000/static/...)
 * to a relative /static/... path so it's served via the Next.js /static proxy.
 * Returns the original value if it isn't a /static path (e.g. S3 URLs pass through).
 */
function normaliseImageUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/static/')) return parsed.pathname; // → /static/...
  } catch {
    // Already relative or invalid — leave as-is
  }
  return url;
}

// ─── Image picker sub-component ───────────────────────────────────────────────
function ImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5 MB');
        return;
      }
      setUploading(true);
      try {
        const url = await uploadMenuImage(file);
        onChange(url);
        toast.success('Image uploaded');
      } catch {
        toast.error('Image upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="col-span-2">
      <label className="label">Item Image</label>

      {value ? (
        /* Preview */
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-700 group">
          <Image
            src={normaliseImageUrl(value)}
            alt="Menu item"
            fill
            className="object-cover"
            unoptimized
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 btn-secondary text-xs py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Change
          </button>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full h-32 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2',
            'text-slate-500 cursor-pointer hover:border-amber-600 hover:text-amber-500 transition-colors',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin text-amber-400" />
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <ImagePlus size={20} />
              <span className="text-xs text-center px-4">
                Click or drag an image here<br />
                <span className="text-slate-600">JPG / PNG / WebP · max 5 MB</span>
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';      // reset so same file can be re-picked
        }}
      />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const qc = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_FORM);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/api/v1/menu/categories').then((r) => r.data),
  });
  const { data: items } = useQuery({
    queryKey: ['menuItems', selectedCat],
    queryFn: () =>
      apiFetch(`/api/v1/menu/items${selectedCat ? `?categoryId=${selectedCat}` : ''}`).then(
        (r) => r.data,
      ),
  });
  const { data: gstRates } = useQuery({
    queryKey: ['gstRates'],
    queryFn: () => apiFetch('/api/v1/menu/gst-rates').then((r) => r.data),
  });

  const filtered =
    items?.filter(
      (i: any) => !search || i.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  const saveItemMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...itemForm,
        price: parseFloat(itemForm.price),
        imageUrl: itemForm.imageUrl || undefined,
      };
      return editItem
        ? apiPut(`/api/v1/menu/items/${editItem.id}`, payload)
        : apiPost('/api/v1/menu/items', payload);
    },
    onSuccess: () => {
      toast.success('Menu item saved');
      qc.invalidateQueries({ queryKey: ['menuItems'] });
      setShowItemForm(false);
      setEditItem(null);
      setItemForm(EMPTY_FORM);
    },
    onError: () => toast.error('Save failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPut(`/api/v1/menu/items/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/menu/items/${id}`),
    onSuccess: () => {
      toast.success('Item removed');
      qc.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });

  function openCreate() {
    setEditItem(null);
    setItemForm({ ...EMPTY_FORM, categoryId: selectedCat || '' });
    setShowItemForm(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setItemForm({
      name: item.name,
      price: item.price.toString(),
      categoryId: item.categoryId ?? item.category_id ?? '',
      isVeg: item.isVeg ?? item.is_veg ?? true,
      description: item.description || '',
      sku: item.sku || '',
      gstRateId: item.gstRateId ?? item.gst_rate_id ?? '',
      // Normalise in case the DB has the old absolute URL format
      imageUrl: normaliseImageUrl(item.imageUrl ?? item.image_url ?? ''),
    });
    setShowItemForm(true);
  }

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <aside className="w-48 flex-shrink-0 bg-slate-900 border-r border-slate-800 p-3 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Categories</div>
        <button
          onClick={() => setSelectedCat(null)}
          className={cn('sidebar-link w-full', !selectedCat && 'sidebar-link-active')}
        >
          All Items
        </button>
        {categories?.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(c.id)}
            className={cn('sidebar-link w-full text-left', selectedCat === c.id && 'sidebar-link-active')}
          >
            {c.name}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filtered.map((item: any) => (
              <div
                key={item.id}
                className={cn('card flex items-center gap-4', !item.isActive && 'opacity-40')}
              >
                {/* Veg dot */}
                <div
                  className={cn(
                    'w-3 h-3 rounded-sm border flex-shrink-0',
                    item.isVeg ? 'border-emerald-500' : 'border-red-500',
                  )}
                >
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full m-0.5',
                      item.isVeg ? 'bg-emerald-500' : 'bg-red-500',
                    )}
                  />
                </div>

                {/* Thumbnail */}
                {(item.imageUrl || item.image_url) ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-slate-700">
                    <Image
                      src={normaliseImageUrl(item.imageUrl || item.image_url)}
                      alt={item.name}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
                    <ImagePlus size={14} className="text-slate-600" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.sku || '—'}</div>
                </div>
                <div className="text-amber-400 font-bold whitespace-nowrap">₹{item.price}</div>
                <div className="text-xs text-slate-500">{item.gstRate || 0}% GST</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                    className="text-slate-400 hover:text-amber-400"
                  >
                    {item.isActive ? (
                      <ToggleRight size={20} className="text-emerald-400" />
                    ) : (
                      <ToggleLeft size={20} />
                    )}
                  </button>
                  <button onClick={() => openEdit(item)} className="btn-ghost p-1">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="btn-ghost p-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-500">No items found</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Item Form Modal ─────────────────────────────────────────────────────── */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">{editItem ? 'Edit Item' : 'Add Menu Item'}</h3>
              <button
                onClick={() => setShowItemForm(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Image picker */}
              <ImagePicker
                value={itemForm.imageUrl}
                onChange={(url) => setItemForm({ ...itemForm, imageUrl: url })}
              />

              {/* Name */}
              <div className="col-span-2">
                <label className="label">Item Name *</label>
                <input
                  className="input"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </div>

              {/* Price + SKU */}
              <div>
                <label className="label">Price (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.01}
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                />
              </div>
              <div>
                <label className="label">SKU / Code</label>
                <input
                  className="input"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                />
              </div>

              {/* Category + GST */}
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {categories?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">GST Rate</label>
                <select
                  className="input"
                  value={itemForm.gstRateId}
                  onChange={(e) => setItemForm({ ...itemForm, gstRateId: e.target.value })}
                >
                  <option value="">— Exempt —</option>
                  {gstRates?.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.rate}%)</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>

              {/* Veg / Non-veg */}
              <div className="col-span-2 flex items-center gap-3">
                <label className="label mb-0">Food type:</label>
                <button
                  type="button"
                  onClick={() => setItemForm({ ...itemForm, isVeg: true })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border',
                    itemForm.isVeg
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-900/20'
                      : 'border-slate-600 text-slate-400',
                  )}
                >
                  🟢 Veg
                </button>
                <button
                  type="button"
                  onClick={() => setItemForm({ ...itemForm, isVeg: false })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border',
                    !itemForm.isVeg
                      ? 'border-red-500 text-red-400 bg-red-900/20'
                      : 'border-slate-600 text-slate-400',
                  )}
                >
                  🔴 Non-Veg
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowItemForm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => saveItemMutation.mutate()}
                disabled={saveItemMutation.isPending || !itemForm.name || !itemForm.price}
                className="btn-primary flex-1"
              >
                {saveItemMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : (
                  'Save Item'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
