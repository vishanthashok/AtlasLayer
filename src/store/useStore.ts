import { create } from 'zustand';
import { Land, HouseModel, ChatMessage } from '../models/types';

export type BasemapProvider = 'mapbox' | 'google';

/** Shared PropertyVision client preference (both Parcelis and Fieldstone map workspaces). */
const BASEMAP_STORAGE_KEY = 'propertyvision_basemap_provider';
const LEGACY_BASEMAP_KEY = 'agrimap_basemap_provider';

interface AppState {
  selectedLand: Land | null;
  selectedHouseModel: HouseModel | null;
  recommendationList: HouseModel[];
  chatHistory: ChatMessage[];
  viewMode: '2D' | '3D';
  aiModel: string;
  basemapProvider: BasemapProvider;
  setSelectedLand: (land: Land | null) => void;
  setSelectedHouseModel: (model: HouseModel | null) => void;
  setRecommendationList: (list: HouseModel[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setViewMode: (mode: '2D' | '3D') => void;
  setAiModel: (model: string) => void;
  setBasemapProvider: (p: BasemapProvider) => void;
  hydrateBasemapFromStorage: () => void;
}

export const useStore = create<AppState>((set) => ({
  selectedLand: null,
  selectedHouseModel: null,
  recommendationList: [],
  chatHistory: [],
  viewMode: '2D',
  aiModel: 'claude-sonnet-4-6',
  basemapProvider: 'mapbox',
  setSelectedLand: (land) => set({ selectedLand: land }),
  setSelectedHouseModel: (model) => set({ selectedHouseModel: model }),
  setRecommendationList: (list) => set({ recommendationList: list }),
  addChatMessage: (message) => set((state) => ({ 
    chatHistory: [...state.chatHistory, message] 
  })),
  clearChatHistory: () => set({ chatHistory: [] }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setAiModel: (model) => set({ aiModel: model }),
  setBasemapProvider: (p) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BASEMAP_STORAGE_KEY, p);
    }
    set({ basemapProvider: p });
  },
  hydrateBasemapFromStorage: () => {
    if (typeof window === 'undefined') return;
    let v = localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (!v) {
      v = localStorage.getItem(LEGACY_BASEMAP_KEY);
      if (v === 'google' || v === 'mapbox') {
        localStorage.setItem(BASEMAP_STORAGE_KEY, v);
      }
    }
    if (v === 'google' || v === 'mapbox') set({ basemapProvider: v });
  },
}));
