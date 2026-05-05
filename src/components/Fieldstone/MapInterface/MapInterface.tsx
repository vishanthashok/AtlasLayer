'use client';

import React, { useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import MapInterfaceMapbox from './MapInterfaceMapbox';
import MapInterfaceGoogle from './MapInterfaceGoogle';

interface MapInterfaceProps {
  selectedLayer: 'rainfall' | 'temp' | 'soil' | 'drought' | 'ndvi' | 'flood';
  onPolygonChange: (polygon: GeoJSON.Polygon | null) => void;
}

export default function MapInterface({ selectedLayer, onPolygonChange }: MapInterfaceProps) {
  const basemapProvider = useStore((s) => s.basemapProvider);
  const hydrateBasemapFromStorage = useStore((s) => s.hydrateBasemapFromStorage);

  useEffect(() => {
    hydrateBasemapFromStorage();
  }, [hydrateBasemapFromStorage]);

  if (basemapProvider === 'google') {
    return <MapInterfaceGoogle selectedLayer={selectedLayer} onPolygonChange={onPolygonChange} />;
  }

  return <MapInterfaceMapbox selectedLayer={selectedLayer} onPolygonChange={onPolygonChange} />;
}
