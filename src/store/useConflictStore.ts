import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CountryRisk, ConflictHeatMapResponse } from '../lib/conflict/types';

export interface ConflictFilters {
  region: string | null;
  stateDeptLevel: number | null;
  minScore: number;
  maxScore: number;
}

interface ConflictStore {
  countries: CountryRisk[];
  filteredCountries: CountryRisk[];
  filters: ConflictFilters;
  selectedCountry: CountryRisk | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  /** Populated from GET /api/conflict/heatmap JSON when `error` / `hint` are returned. */
  heatmapApiError: string | null;
  heatmapApiHint: string | null;
  heatmapUsedAnonFallback: boolean;

  fetchHeatmap: () => Promise<void>;
  setFilters: (filters: Partial<ConflictFilters>) => void;
  selectCountry: (country: CountryRisk | null) => void;
  applyFilters: () => void;
}

const DEFAULT_FILTERS: ConflictFilters = {
  region: null,
  stateDeptLevel: null,
  minScore: 0,
  maxScore: 1,
};

function applyFiltersToList(
  countries: CountryRisk[],
  filters: ConflictFilters
): CountryRisk[] {
  return countries.filter(
    (c) =>
      (!filters.region || c.region === filters.region) &&
      c.composite_score >= filters.minScore &&
      c.composite_score <= filters.maxScore &&
      (filters.stateDeptLevel == null || c.state_dept_level === filters.stateDeptLevel)
  );
}

export const useConflictStore = create<ConflictStore>()(
  subscribeWithSelector((set, get) => ({
    countries: [],
    filteredCountries: [],
    filters: { ...DEFAULT_FILTERS },
    selectedCountry: null,
    lastUpdated: null,
    isLoading: false,
    error: null,
    heatmapApiError: null,
    heatmapApiHint: null,
    heatmapUsedAnonFallback: false,

    fetchHeatmap: async () => {
      set({
        isLoading: true,
        error: null,
        heatmapApiError: null,
        heatmapApiHint: null,
        heatmapUsedAnonFallback: false,
      });
      try {
        const { filters } = get();
        const params = new URLSearchParams();
        if (filters.region) params.set('region', filters.region);
        params.set('min_score', String(filters.minScore));
        params.set('max_score', String(filters.maxScore));
        if (filters.stateDeptLevel != null) params.set('level', String(filters.stateDeptLevel));

        const resp = await fetch(`/api/conflict/heatmap?${params.toString()}`);
        const data = (await resp.json()) as ConflictHeatMapResponse;
        const all = data.countries ?? [];
        set({
          countries: all,
          filteredCountries: applyFiltersToList(all, filters),
          lastUpdated: new Date(),
          isLoading: false,
          heatmapApiError: data.error ?? null,
          heatmapApiHint: data.hint ?? null,
          heatmapUsedAnonFallback: data.used_anon_fallback ?? false,
        });
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : String(e),
          isLoading: false,
          heatmapApiError: 'heatmap_fetch_failed',
          heatmapApiHint: e instanceof Error ? e.message : String(e),
        });
      }
    },

    setFilters: (next) => {
      const filters = { ...get().filters, ...next };
      set({
        filters,
        filteredCountries: applyFiltersToList(get().countries, filters),
      });
    },

    selectCountry: (country) => set({ selectedCountry: country }),

    applyFilters: () => {
      const { countries, filters } = get();
      set({ filteredCountries: applyFiltersToList(countries, filters) });
    },
  }))
);
