'use client';
import { useState, useEffect } from 'react';
import { flushSyncQueue, getPendingSyncItems, getResolvedId } from '@/lib/offline';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { usePosStore } from '@/store/pos.store';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Flush queued offline mutations when coming back online
      const pending = await getPendingSyncItems();
      if (pending.length > 0) {
        console.log(`[Offline] Flushing ${pending.length} queued items`);
        await flushSyncQueue(async (item, idMap) => {
          let payloadStr = JSON.stringify(item.payload);
          // Replace offline IDs with real server IDs
          for (const [offlineId, realId] of Object.entries(idMap)) {
            payloadStr = payloadStr.replaceAll(offlineId, realId);
          }
          const payload = JSON.parse(payloadStr);

          const entityId = item.entityId ? (idMap[item.entityId] || item.entityId) : '';
          let entityType = item.entityType;
          for (const [offlineId, realId] of Object.entries(idMap)) {
            entityType = entityType.replaceAll(offlineId, realId);
          }

          // Guard: if any OFFLINE- id is still unresolved, the parent order hasn't synced yet
          // (it likely failed this round). Keep this item in queue (__RETRY__) so it can be
          // retried on the next online event when the parent order may succeed.
          const stillHasOfflineId =
            payloadStr.includes('"OFFLINE-') ||
            entityType.includes('OFFLINE-') ||
            entityId.startsWith('OFFLINE-');

          if (stillHasOfflineId) {
            console.warn('[Offline] Parent order not yet synced, will retry bill next session:', item.id);
            return '__RETRY__'; // keep in queue, bump retry count
          }

          if (item.operation === 'create') {
            const res = await apiPost(`/api/v1/${entityType}`, payload);
            return res.data?.id;
          }
          else if (item.operation === 'update') {
            const url = entityId ? `/api/v1/${entityType}/${entityId}` : `/api/v1/${entityType}`;
            await apiPatch(url, payload);
          }
          else if (item.operation === 'delete') {
            const url = entityId ? `/api/v1/${entityType}/${entityId}` : `/api/v1/${entityType}`;
            await apiDelete(url);
          }
        });

        // After sync: if PosStore still holds an OFFLINE-xxx order ID, patch it to real UUID
        const currentOrder = usePosStore.getState().currentOrder;
        if (currentOrder?.startsWith('OFFLINE-')) {
          const resolved = await getResolvedId(currentOrder);
          if (resolved) {
            usePosStore.getState().setCurrentOrder(resolved);
            console.log('[Offline] Updated PosStore currentOrder:', currentOrder, '→', resolved);
          }
        }
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
