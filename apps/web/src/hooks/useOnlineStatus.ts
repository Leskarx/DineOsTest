'use client';
import { useState, useEffect } from 'react';
import { flushSyncQueue, getPendingSyncItems } from '@/lib/offline';
import { api } from '@/lib/api';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Flush queued offline mutations when coming back online
      const pending = await getPendingSyncItems();
      if (pending.length > 0) {
        console.log(`[Offline] Flushing ${pending.length} queued items`);
        await flushSyncQueue(async (item) => {
          if (item.operation === 'create') await api.post(`/api/v1/${item.entityType}`, item.payload);
          else if (item.operation === 'update') await api.patch(`/api/v1/${item.entityType}/${item.entityId}`, item.payload);
          else if (item.operation === 'delete') await api.delete(`/api/v1/${item.entityType}/${item.entityId}`);
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
