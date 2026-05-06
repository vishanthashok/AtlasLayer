'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapboxMap, {
  Layer,
  Source,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FillLayerSpecification, LineLayerSpecification, Map as MapboxMapInstance } from 'mapbox-gl';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { CountryRisk } from '../../lib/conflict/types';
import { RISK_HEX_STOPS } from './colors';
import styles from './WorldHeatMap.module.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Stable Natural Earth GeoJSON source with ISO_A3 properties on every feature.
const GEO_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

interface Props {
  countries: CountryRisk[];
  onSelect: (country: CountryRisk) => void;
  selectedIso: string | null;
}

interface CountryFeatureProps {
  ISO_A3?: string;
  iso_a3?: string;
  ADMIN?: string;
  name?: string;
  risk_score: number | null;
  state_dept_level: number | null;
}

interface CountryFeature {
  type: 'Feature';
  id?: string | number;
  properties: CountryFeatureProps;
  geometry: GeoJSON.Geometry;
}

interface CountryFeatureCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

/** Stable empty GeoJSON so `<Source>` never unmounts when `geoJson` is briefly null (Strict Mode / remount). Unmounting triggers Mapbox `removeSource` racing terrain → crash. */
const EMPTY_FEATURE_COLLECTION: CountryFeatureCollection = Object.freeze({
  type: 'FeatureCollection',
  features: [],
});

const RISK_INTERPOLATE_STOPS = RISK_HEX_STOPS.flatMap(
  ([stop, color]) => [stop, color] as [number, string]
);

const FILL_LAYER: FillLayerSpecification = {
  id: 'country-fill',
  type: 'fill',
  source: 'countries',
  paint: {
    'fill-color': [
      'case',
      ['==', ['get', 'risk_score'], null],
      'rgba(40, 48, 60, 0.0)',
      [
        'interpolate',
        ['linear'],
        ['to-number', ['get', 'risk_score']],
        ...RISK_INTERPOLATE_STOPS,
      ],
    ],
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.85,
      ['==', ['get', 'risk_score'], null],
      0,
      0.55,
    ],
  } as FillLayerSpecification['paint'],
};

const OUTLINE_LAYER: LineLayerSpecification = {
  id: 'country-outline',
  type: 'line',
  source: 'countries',
  paint: {
    'line-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      '#00d4d4',
      'rgba(255, 255, 255, 0.12)',
    ],
    'line-width': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      1.5,
      0.4,
    ],
  } as LineLayerSpecification['paint'],
};

const INTERACTIVE_LAYERS = ['country-fill'];

function mapReadyForCountriesSource(map: MapboxMapInstance | undefined): map is MapboxMapInstance {
  return !!map?.isStyleLoaded?.() && !!map.getSource('countries');
}

export function WorldHeatMap({ countries, onSelect, selectedIso }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const baseGeoJsonRef = useRef<CountryFeatureCollection | null>(null);
  const hoveredIsoRef = useRef<string | null>(null);
  const selectedIsoRef = useRef<string | null>(null);

  const [geoJson, setGeoJson] = useState<CountryFeatureCollection | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    score: number | null;
    level: number | null;
  } | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 20,
    latitude: 20,
    zoom: 1.4,
    pitch: 0,
    bearing: 0,
  });
  const [mapStyleReady, setMapStyleReady] = useState(false);

  const byIsoA3 = useMemo(() => {
    const m = new Map<string, CountryRisk>();
    for (const c of countries) {
      // CHAR-padded ISO_A3 from Postgres + Natural Earth uppercase ISO_A3.
      const iso3 = (c.iso_a3 ?? '').trim().toUpperCase();
      if (iso3) m.set(iso3, c);
    }
    return m;
  }, [countries]);

  // One-time fetch of country geometry.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await fetch(GEO_URL);
        const fc = (await resp.json()) as CountryFeatureCollection;
        if (cancelled) return;
        const features = fc.features.map((f, idx) => {
          const iso3 = (f.properties?.ISO_A3 ?? f.properties?.iso_a3 ?? '').toUpperCase();
          const name = f.properties?.ADMIN ?? f.properties?.name ?? '';
          return {
            ...f,
            id: idx + 1,
            properties: {
              ...f.properties,
              ISO_A3: iso3,
              ADMIN: name,
              risk_score: null,
              state_dept_level: null,
            },
          } as CountryFeature;
        });
        baseGeoJsonRef.current = { type: 'FeatureCollection', features };
        setGeoJson({ type: 'FeatureCollection', features });
      } catch (e) {
        console.warn('[WorldHeatMap] failed to fetch country GeoJSON', e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever scores change, splice them into the cached features and update the source.
  useEffect(() => {
    const base = baseGeoJsonRef.current;
    if (!base) return;
    const next: CountryFeatureCollection = {
      type: 'FeatureCollection',
      features: base.features.map((f) => {
        const iso3 = f.properties.ISO_A3 ?? '';
        const country = byIsoA3.get(iso3);
        return {
          ...f,
          properties: {
            ...f.properties,
            risk_score: country?.composite_score ?? null,
            state_dept_level: country?.state_dept_level ?? null,
          },
        };
      }),
    };
    setGeoJson(next);
  }, [byIsoA3]);

  // Sync selected feature-state.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!mapReadyForCountriesSource(map)) return;
    if (selectedIsoRef.current && selectedIsoRef.current !== selectedIso) {
      const prev = baseGeoJsonRef.current?.features.find(
        (f) => f.properties.ISO_A3 === selectedIsoRef.current
      );
      if (prev?.id != null) {
        map.setFeatureState({ source: 'countries', id: prev.id }, { selected: false });
      }
    }
    if (selectedIso) {
      const cur = baseGeoJsonRef.current?.features.find((f) => {
        const iso3 = f.properties.ISO_A3 ?? '';
        const fromIso2 = countries.find((c) => c.iso_a2 === selectedIso)?.iso_a3?.trim().toUpperCase();
        return iso3 === fromIso2;
      });
      if (cur?.id != null) {
        map.setFeatureState({ source: 'countries', id: cur.id }, { selected: true });
      }
      selectedIsoRef.current = selectedIso;
    } else {
      selectedIsoRef.current = null;
    }
  }, [selectedIso, countries, mapStyleReady]);

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!mapReadyForCountriesSource(map)) return;
      const f = e.features?.[0];
      const prevIso = hoveredIsoRef.current;
      if (!f) {
        if (prevIso) {
          const prev = baseGeoJsonRef.current?.features.find(
            (ff) => ff.properties.ISO_A3 === prevIso
          );
          if (prev?.id != null) {
            map.setFeatureState({ source: 'countries', id: prev.id }, { hover: false });
          }
          hoveredIsoRef.current = null;
        }
        setTooltip(null);
        map.getCanvas().style.cursor = '';
        return;
      }
      const props = f.properties as CountryFeatureProps;
      const iso3 = props.ISO_A3 ?? '';
      const score = props.risk_score == null ? null : Number(props.risk_score);
      const level = props.state_dept_level == null ? null : Number(props.state_dept_level);
      const name = props.ADMIN ?? 'Unknown';

      if (prevIso && prevIso !== iso3) {
        const prev = baseGeoJsonRef.current?.features.find(
          (ff) => ff.properties.ISO_A3 === prevIso
        );
        if (prev?.id != null) {
          map.setFeatureState({ source: 'countries', id: prev.id }, { hover: false });
        }
      }
      if (iso3 !== prevIso && f.id != null) {
        map.setFeatureState({ source: 'countries', id: f.id }, { hover: true });
        hoveredIsoRef.current = iso3;
      }
      setTooltip({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        name,
        score,
        level,
      });
      map.getCanvas().style.cursor = score != null ? 'pointer' : '';
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!mapReadyForCountriesSource(map)) return;
    if (hoveredIsoRef.current) {
      const prev = baseGeoJsonRef.current?.features.find(
        (ff) => ff.properties.ISO_A3 === hoveredIsoRef.current
      );
      if (prev?.id != null) {
        map.setFeatureState({ source: 'countries', id: prev.id }, { hover: false });
      }
      hoveredIsoRef.current = null;
    }
    setTooltip(null);
    map.getCanvas().style.cursor = '';
  }, []);

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const iso3 = (f.properties as CountryFeatureProps).ISO_A3 ?? '';
      const country = byIsoA3.get(iso3);
      if (country) onSelect(country);
    },
    [byIsoA3, onSelect]
  );

  const zoomBy = useCallback((delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(8, prev.zoom + delta)),
    }));
  }, []);

  const resetView = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      longitude: 20,
      latitude: 20,
      zoom: 1.4,
      pitch: 0,
      bearing: 0,
    }));
    mapRef.current?.getMap()?.easeTo({
      center: [20, 20],
      zoom: 1.4,
      pitch: 0,
      bearing: 0,
      duration: 600,
    });
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={styles.mapWrapper}>
        <div className={styles.missingToken}>Missing NEXT_PUBLIC_MAPBOX_TOKEN</div>
      </div>
    );
  }

  return (
    <div className={styles.mapWrapper}>
      <MapboxMap
        {...viewState}
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        projection={{ name: 'globe' }}
        fog={{
          color: 'rgb(13, 17, 23)',
          'high-color': 'rgb(36, 92, 223)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(6, 8, 13)',
          'star-intensity': 0.5,
        }}
        attributionControl={false}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        onMove={(evt) => setViewState(evt.viewState)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onLoad={() => setMapStyleReady(true)}
      >
        <Source id="countries" type="geojson" data={geoJson ?? EMPTY_FEATURE_COLLECTION}>
          <Layer {...FILL_LAYER} />
          <Layer {...OUTLINE_LAYER} />
        </Source>
      </MapboxMap>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={() => zoomBy(0.6)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className={styles.controlBtn}
          onClick={() => zoomBy(-0.6)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <div className={styles.divider} />
        <button
          type="button"
          className={styles.controlBtn}
          onClick={resetView}
          title="Reset view"
          aria-label="Reset view"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {!geoJson && <div className={styles.loadingOverlay}>Loading globe…</div>}

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className={styles.tooltipName}>{tooltip.name}</div>
          <div className={styles.tooltipMeta}>
            {tooltip.score != null
              ? `Risk ${(tooltip.score * 100).toFixed(0)}/100`
              : 'No score yet'}
            {tooltip.level != null ? ` · Level ${tooltip.level}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
