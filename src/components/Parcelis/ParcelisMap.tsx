'use client';

import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import ParcelisMapMapbox from './ParcelisMapMapbox';
import ParcelisMapGoogle from './ParcelisMapGoogle';

interface ParcelisMapProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export default function ParcelisMap({ onAnalyze, isAnalyzing }: ParcelisMapProps) {
  const basemapProvider = useStore((s) => s.basemapProvider);
  const hydrateBasemapFromStorage = useStore((s) => s.hydrateBasemapFromStorage);

  useEffect(() => {
    hydrateBasemapFromStorage();
  }, [hydrateBasemapFromStorage]);

  if (basemapProvider === 'google') {
    return <ParcelisMapGoogle onAnalyze={onAnalyze} isAnalyzing={isAnalyzing} />;
  }

  return <ParcelisMapMapbox onAnalyze={onAnalyze} isAnalyzing={isAnalyzing} />;
}
