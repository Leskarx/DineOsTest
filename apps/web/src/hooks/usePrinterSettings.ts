'use client';
import { useState, useEffect } from 'react';
import type { PrinterWidth } from '@/lib/printer';

export interface PrinterSettings {
  width: PrinterWidth;
  method: 'browser' | 'serial';
  footerMessage: string;
  beepOnPrint: boolean;
}

const STORAGE_KEY = 'dinestay:printer';

const DEFAULTS: PrinterSettings = {
  width: 80,
  method: 'browser',
  footerMessage: 'Thank you for dining with us!',
  beepOnPrint: false,
};

export function usePrinterSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignore parse errors — use defaults
    }
    setLoaded(true);
  }, []);

  function update(patch: Partial<PrinterSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { settings, update, loaded };
}
