/**
 * Offline-first storage using IndexedDB (via idb)
 * Queues mutations when offline and syncs when back online
 */
import { openDB, IDBPDatabase } from 'idb';
import { generateId } from './utils';

const DB_NAME = 'dinestay-offline';
const DB_VERSION = 2;

interface SyncItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  branchId: string;
  tenantId: string;
  createdAt: number;
  retryCount: number;
}

let db: IDBPDatabase | null = null;

export async function getDb(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Sync queue for offline mutations
      if (!database.objectStoreNames.contains('syncQueue')) {
        const store = database.createObjectStore('syncQueue', { keyPath: 'id' });
        store.createIndex('by-entity', 'entityType');
        store.createIndex('by-branch', 'branchId');
      }

      // Cached read data
      if (!database.objectStoreNames.contains('menuItems')) {
        database.createObjectStore('menuItems', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('categories')) {
        database.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('tables')) {
        database.createObjectStore('tables', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('orders')) {
        const os = database.createObjectStore('orders', { keyPath: 'id' });
        os.createIndex('by-branch', 'branchId');
        os.createIndex('by-status', 'status');
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
      // Persistent mapping: OFFLINE-xxx → real-uuid survives page refreshes
      if (!database.objectStoreNames.contains('resolvedIds')) {
        database.createObjectStore('resolvedIds', { keyPath: 'offlineId' });
      }
    },
  });

  return db;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

export async function cacheMenuItems(items: any[]) {
  const db = await getDb();
  const tx = db.transaction('menuItems', 'readwrite');
  await Promise.all(items.map((i) => tx.store.put(i)));
  await tx.done;
}

export async function getCachedMenuItems(): Promise<any[]> {
  const db = await getDb();
  return db.getAll('menuItems');
}

export async function cacheCategories(cats: any[]) {
  const db = await getDb();
  const tx = db.transaction('categories', 'readwrite');
  await Promise.all(cats.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function getCachedCategories(): Promise<any[]> {
  const db = await getDb();
  return db.getAll('categories');
}

export async function cacheTables(tables: any[]) {
  const db = await getDb();
  const tx = db.transaction('tables', 'readwrite');
  await Promise.all(tables.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTables(): Promise<any[]> {
  const db = await getDb();
  return db.getAll('tables');
}

export async function saveOrderLocally(order: any) {
  const db = await getDb();
  await db.put('orders', { ...order, _local: true, _syncedAt: null });
}

export async function getLocalOrders(branchId: string): Promise<any[]> {
  const db = await getDb();
  return db.getAllFromIndex('orders', 'by-branch', branchId);
}

// ─── Resolved ID mappings ────────────────────────────────────────────────────
// Persist OFFLINE-xxx → real-uuid so BillingModal & PosStore can resolve
// the correct server ID even after a page refresh.

export async function saveResolvedId(offlineId: string, realId: string) {
  const db = await getDb();
  await db.put('resolvedIds', { offlineId, realId, savedAt: Date.now() });
}

export async function getResolvedId(offlineId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get('resolvedIds', offlineId);
  return row?.realId ?? null;
}

// ─── Sync Queue ──────────────────────────────────────────────────────────────

export async function enqueueSync(item: Omit<SyncItem, 'id' | 'createdAt' | 'retryCount'>) {
  const db = await getDb();
  await db.put('syncQueue', {
    ...item,
    id: generateId(),
    createdAt: Date.now(),
    retryCount: 0,
  });
}

export async function getPendingSyncItems(): Promise<SyncItem[]> {
  const db = await getDb();
  return db.getAll('syncQueue');
}

export async function removeSyncItem(id: string) {
  const db = await getDb();
  await db.delete('syncQueue', id);
}

export async function incrementRetry(id: string) {
  const db = await getDb();
  const item = await db.get('syncQueue', id);
  if (item) {
    await db.put('syncQueue', { ...item, retryCount: item.retryCount + 1 });
  }
}

// ─── Online sync runner ───────────────────────────────────────────────────────

export async function flushSyncQueue(
  apiFn: (item: SyncItem, idMap: Record<string, string>) => Promise<string | void>,
  onProgress?: (done: number, total: number) => void,
) {
  const MAX_RETRIES = 10;

  // Sort by creation time so order→items→bill are always processed in the right sequence
  const allItems = (await getPendingSyncItems()).sort((a, b) => a.createdAt - b.createdAt);

  // Drop items that have exceeded max retries (truly unrecoverable)
  const items: SyncItem[] = [];
  for (const item of allItems) {
    if (item.retryCount >= MAX_RETRIES) {
      console.warn('[Offline] Dropping item after max retries:', item.id, item.entityType);
      await removeSyncItem(item.id);
    } else {
      items.push(item);
    }
  }

  // Heal orphaned bills: bills with OFFLINE- orderId but no matching order-create in queue.
  // Try to resolve via persistent resolvedIds store; drop if still unresolvable.
  const orderCreateIds = new Set(
    items.filter((i) => i.entityType === 'orders' && i.operation === 'create').map((i) => i.entityId)
  );
  for (const item of items) {
    if (item.entityType === 'billing/bills' && item.entityId.startsWith('OFFLINE-')) {
      if (!orderCreateIds.has(item.entityId)) {
        // No matching order-create — try persistent store
        const realOrderId = await getResolvedId(item.entityId);
        if (realOrderId) {
          // Rewrite the bill payload in DB with the real order UUID
          const db = await getDb();
          let payloadStr = JSON.stringify(item.payload);
          payloadStr = payloadStr.replaceAll(item.entityId, realOrderId);
          item.payload = JSON.parse(payloadStr);
          item.entityId = realOrderId;
          await db.put('syncQueue', item);
          console.log('[Offline] Healed orphaned bill using persisted ID:', realOrderId);
        } else {
          // Truly irrecoverable — no order on server, no mapping
          console.warn('[Offline] Dropping orphaned bill with no resolvable order:', item.id);
          await removeSyncItem(item.id);
        }
      }
    }
  }

  // Re-fetch items after cleanup (some may have been healed or dropped)
  const healedItems = (await getPendingSyncItems()).sort((a, b) => a.createdAt - b.createdAt);
  items.length = 0;
  for (const item of healedItems) {
    if (item.retryCount < MAX_RETRIES) items.push(item);
    else { console.warn('[Offline] Dropping item after max retries:', item.id); await removeSyncItem(item.id); }
  }

  let done = 0;
  const idMap: Record<string, string> = {};

  for (const item of items) {
    try {
      const realId = await apiFn(item, idMap);

      // '__DROP__' = truly unrecoverable, remove immediately
      if (realId === '__DROP__') {
        await removeSyncItem(item.id);
        done++;
        onProgress?.(done, items.length);
        continue;
      }

      // '__RETRY__' = parent not ready yet, keep item and bump retry count
      if (realId === '__RETRY__') {
        await incrementRetry(item.id);
        done++;
        onProgress?.(done, items.length);
        continue;
      }

      if (realId && typeof realId === 'string' && item.entityId.startsWith('OFFLINE-')) {
        idMap[item.entityId] = realId;
        // Persist so BillingModal and PosStore can look up the real UUID even after refresh
        await saveResolvedId(item.entityId, realId);

        // Rewrite all pending items in DB to permanently save the new real ID
        const db = await getDb();
        const pending = await db.getAll('syncQueue');
        for (const p of pending) {
          let changed = false;
          let payloadStr = p.payload ? JSON.stringify(p.payload) : '';
          if (payloadStr.includes(item.entityId)) {
            payloadStr = payloadStr.replaceAll(item.entityId, realId);
            p.payload = JSON.parse(payloadStr);
            changed = true;
          }
          if (p.entityType && p.entityType.includes(item.entityId)) {
            p.entityType = p.entityType.replaceAll(item.entityId, realId);
            changed = true;
          }
          if (p.entityId === item.entityId) {
            p.entityId = realId;
            changed = true;
          }
          if (changed) {
            await db.put('syncQueue', p);
          }
        }
      }
      await removeSyncItem(item.id);
    } catch (err) {
      await incrementRetry(item.id);
      console.warn('Sync failed for item', item.id, err);
    }
    done++;
    onProgress?.(done, items.length);
  }
}

// ─── Set last-sync timestamp ─────────────────────────────────────────────────

export async function setLastSync(key: string, ts: number) {
  const db = await getDb();
  await db.put('meta', { key, value: ts });
}

export async function getLastSync(key: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}
