'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CountryRisk } from '../lib/conflict/types';

export interface WatchlistAlert {
  id: string;
  entityIso: string;
  entityName: string;
  message: string;
  prevScore: number;
  newScore: number;
  timestamp: string;
  read: boolean;
}

interface WatchlistStore {
  watchedIsos: Set<string>;
  alerts: WatchlistAlert[];
  unreadCount: number;

  addToWatchlist: (iso: string) => void;
  removeFromWatchlist: (iso: string) => void;
  toggleWatchlist: (iso: string) => void;
  isWatched: (iso: string) => boolean;
  checkForAlerts: (countries: CountryRisk[], prevCountries: CountryRisk[]) => void;
  markAllRead: () => void;
  dismissAlert: (id: string) => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'atlaslayer_watchlist';
const ALERTS_KEY = 'atlaslayer_watch_alerts';
const SCORE_DELTA_THRESHOLD = 0.05;

export const useWatchlistStore = create<WatchlistStore>()(
  subscribeWithSelector((set, get) => ({
    watchedIsos: new Set<string>(),
    alerts: [],
    unreadCount: 0,

    addToWatchlist: (iso) => {
      const next = new Set(get().watchedIsos);
      next.add(iso.toUpperCase());
      set({ watchedIsos: next });
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      }
    },

    removeFromWatchlist: (iso) => {
      const next = new Set(get().watchedIsos);
      next.delete(iso.toUpperCase());
      set({ watchedIsos: next });
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      }
    },

    toggleWatchlist: (iso) => {
      if (get().isWatched(iso)) get().removeFromWatchlist(iso);
      else get().addToWatchlist(iso);
    },

    isWatched: (iso) => get().watchedIsos.has(iso.toUpperCase()),

    checkForAlerts: (countries, prevCountries) => {
      const { watchedIsos } = get();
      if (watchedIsos.size === 0) return;

      const prevMap = new Map(prevCountries.map(c => [c.iso_a2, c.composite_score]));
      const newAlerts: WatchlistAlert[] = [];

      for (const country of countries) {
        if (!watchedIsos.has(country.iso_a2)) continue;
        const prev = prevMap.get(country.iso_a2);
        if (prev == null) continue;
        const delta = country.composite_score - prev;
        if (Math.abs(delta) < SCORE_DELTA_THRESHOLD) continue;

        newAlerts.push({
          id: `${country.iso_a2}-${Date.now()}`,
          entityIso: country.iso_a2,
          entityName: country.name,
          message: delta > 0
            ? `Risk score increased from ${(prev * 100).toFixed(0)} to ${(country.composite_score * 100).toFixed(0)}`
            : `Risk score decreased from ${(prev * 100).toFixed(0)} to ${(country.composite_score * 100).toFixed(0)}`,
          prevScore: prev,
          newScore: country.composite_score,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }

      if (newAlerts.length > 0) {
        const all = [...newAlerts, ...get().alerts].slice(0, 50);
        const unread = all.filter(a => !a.read).length;
        set({ alerts: all, unreadCount: unread });
        if (typeof window !== 'undefined') {
          localStorage.setItem(ALERTS_KEY, JSON.stringify(all));
        }
      }
    },

    markAllRead: () => {
      const alerts = get().alerts.map(a => ({ ...a, read: true }));
      set({ alerts, unreadCount: 0 });
      if (typeof window !== 'undefined') localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    },

    dismissAlert: (id) => {
      const alerts = get().alerts.filter(a => a.id !== id);
      set({ alerts, unreadCount: alerts.filter(a => !a.read).length });
      if (typeof window !== 'undefined') localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    },

    hydrate: () => {
      if (typeof window === 'undefined') return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) set({ watchedIsos: new Set(JSON.parse(raw) as string[]) });
        const alertsRaw = localStorage.getItem(ALERTS_KEY);
        if (alertsRaw) {
          const alerts = JSON.parse(alertsRaw) as WatchlistAlert[];
          set({ alerts, unreadCount: alerts.filter(a => !a.read).length });
        }
      } catch { /* ignore */ }
    },
  }))
);
