'use client';

import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import styles from './BasemapToggle.module.css';

export default function BasemapToggle() {
  const basemapProvider = useStore((s) => s.basemapProvider);
  const setBasemapProvider = useStore((s) => s.setBasemapProvider);
  const hydrateBasemapFromStorage = useStore((s) => s.hydrateBasemapFromStorage);

  useEffect(() => {
    hydrateBasemapFromStorage();
  }, [hydrateBasemapFromStorage]);

  return (
    <div className={styles.wrap} role="group" aria-label="Basemap provider">
      <button
        type="button"
        className={`${styles.pill} ${basemapProvider === 'mapbox' ? styles.pillActive : ''}`}
        onClick={() => setBasemapProvider('mapbox')}
      >
        Mapbox
      </button>
      <button
        type="button"
        className={`${styles.pill} ${basemapProvider === 'google' ? styles.pillActive : ''}`}
        onClick={() => setBasemapProvider('google')}
      >
        Google
      </button>
    </div>
  );
}
