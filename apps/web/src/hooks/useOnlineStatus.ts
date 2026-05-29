'use client';
import { useState, useEffect } from 'react';
import { flushSyncQueue, getPendingSyncItems } from '@/lib/offline';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';

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

          if (item.operation === 'create') {
            const url = entityId ? `/api/v1/${entityType}/${entityId}` : `/api/v1/${entityType}`;
            const res = await apiPost(url, payload);
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
