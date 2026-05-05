'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';
import * as turf from '@turf/turf';
import { useStore } from '../../store/useStore';
import { ZoomIn, ZoomOut, Scan, RotateCcw, Layers, Box } from 'lucide-react';
import styles from './ParcelisMap.module.css';
import BasemapToggle from '../maps/BasemapToggle';
import GoogleMapsBlocked from '../maps/GoogleMapsBlocked';
import { buildHouseFootprintGeometries } from './houseFootprintGeometry';
import { googleForwardGeocode, googleReverseGeocode } from '../../lib/maps/googleGeocode';
import {
  PROPERTYVISION_GOOGLE_MAPS_LIBRARIES,
  PROPERTYVISION_GOOGLE_MAPS_SCRIPT_ID,
  PROPERTYVISION_GOOGLE_MAPS_VERSION,
  subscribeGoogleMapsAuthFailure,
} from '../../lib/maps/googleMapsLoader';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const mapContainerStyle: React.CSSProperties = { width: '100%', height: '100%' };

const ROOM_COLORS = ['#1a3a5c', '#162e48', '#1a3a5c', '#0f2236'];

interface ParcelisMapGoogleProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export default function ParcelisMapGoogle({ onAnalyze, isAnalyzing }: ParcelisMapGoogleProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { selectedLand, setSelectedLand, viewMode, setViewMode, selectedHouseModel } = useStore();

  const [center, setCenter] = useState({ lat: 38, lng: -98 });
  const [zoom, setZoom] = useState(4);
  const [searchInput, setSearchInput] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [authFailure, setAuthFailure] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: PROPERTYVISION_GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: GOOGLE_KEY,
    version: PROPERTYVISION_GOOGLE_MAPS_VERSION,
    libraries: PROPERTYVISION_GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!GOOGLE_KEY) return;
    return subscribeGoogleMapsAuthFailure(() => setAuthFailure(true));
  }, []);

  const zoomBy = (delta: number) => {
    setZoom((z) => Math.min(22, Math.max(1, z + delta)));
  };

  const reset3D = () => {
    setViewMode('2D');
    mapRef.current?.setTilt(0);
  };

  const toggle3D = () => {
    if (viewMode === '3D') {
      reset3D();
    } else {
      setViewMode('3D');
      setZoom((z) => Math.max(z, 18));
      mapRef.current?.setTilt(45);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const tilt = viewMode === '3D' ? 45 : 0;
    mapRef.current.setTilt(tilt);
  }, [viewMode]);

  const processCoordinates = useCallback(
    async (lng: number, lat: number) => {
      setLngInput(lng.toFixed(5));
      setLatInput(lat.toFixed(5));

      let address = 'Custom Location';
      if (GOOGLE_KEY) {
        const rev = await googleReverseGeocode(lat, lng, GOOGLE_KEY);
        if (rev) address = rev;
      }

      const point = turf.point([lng, lat]);
      const buffered = turf.buffer(point, 20, { units: 'meters' })!;
      const lotPolygon = turf.bboxPolygon(turf.bbox(buffered));
      const landArea = turf.area(lotPolygon) * 10.7639;

      setSelectedLand({
        id: `land_${Date.now()}`,
        latitude: lat,
        longitude: lng,
        address,
        polygon: lotPolygon.geometry,
        estimatedLotSize: Math.round(landArea),
        orientationAngle: 0,
      });

      setCenter({ lat, lng });
      setZoom(19);
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(19);
    },
    [setSelectedLand]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput || !GOOGLE_KEY) return;
    const r = await googleForwardGeocode(searchInput, GOOGLE_KEY);
    if (r) {
      setSearchInput('');
      await processCoordinates(r.lng, r.lat);
    }
  };

  const handleCoordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) await processCoordinates(lng, lat);
  };

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  const { houseBaseGeoJSON, houseRoofGeoJSON, houseFloorPlanGeoJSON } = buildHouseFootprintGeometries(
    selectedLand,
    selectedHouseModel
  );

  const lotPaths =
    selectedLand?.polygon &&
    typeof selectedLand.polygon === 'object' &&
    selectedLand.polygon.type === 'Polygon' &&
    Array.isArray(selectedLand.polygon.coordinates?.[0])
      ? (selectedLand.polygon.coordinates[0] as number[][]).map(([lng, lat]) => ({ lat, lng }))
      : null;

  const ringToPath = (coords: number[][]) => coords.map(([lng, lat]) => ({ lat, lng }));

  return (
    <div className={styles.mapWrapper}>
      <div className={styles.topBar}>
        <BasemapToggle />
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search address or place..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={styles.input}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>
        <form onSubmit={handleCoordSubmit} className={styles.coordForm}>
          <input
            type="text"
            placeholder="Lat"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            className={styles.coordInput}
          />
          <input
            type="text"
            placeholder="Lng"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            className={styles.coordInput}
          />
          <button type="submit" className={styles.coordBtn}>
            →
          </button>
        </form>
      </div>

      <div className={styles.mapControls}>
        <button className={styles.mapBtn} onClick={() => zoomBy(1)} title="Zoom in">
          <ZoomIn size={15} />
        </button>
        <button className={styles.mapBtn} onClick={() => zoomBy(-1)} title="Zoom out">
          <ZoomOut size={15} />
        </button>
        <div className={styles.divider} />
        <button
          className={`${styles.mapBtn} ${viewMode === '3D' ? styles.mapBtnActive : ''}`}
          onClick={toggle3D}
          title="Map tilt (3D building view is best on Mapbox)"
        >
          {viewMode === '3D' ? <Box size={15} /> : <Layers size={15} />}
        </button>
        <button className={styles.mapBtn} onClick={reset3D} title="Reset view">
          <RotateCcw size={13} />
        </button>
      </div>

      {selectedLand && (
        <button
          className={`${styles.analyzeBtn} ${isAnalyzing ? styles.analyzingBtn : ''}`}
          onClick={onAnalyze}
          disabled={isAnalyzing}
        >
          <Scan size={14} />
          {isAnalyzing ? 'Analyzing parcel...' : 'Analyze This Parcel'}
        </button>
      )}

      {!GOOGLE_KEY ? (
        <div className={styles.missingToken}>Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</div>
      ) : loadError ? (
        <div className={styles.missingToken}>
          <GoogleMapsBlocked loadError={loadError} authFailure={false} />
        </div>
      ) : !isLoaded ? (
        <div className={styles.missingToken}>Loading map…</div>
      ) : (
        <div className={styles.mapCanvas}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={zoom}
            onLoad={onMapLoad}
            mapTypeId={google.maps.MapTypeId.HYBRID}
            onClick={(e) => {
              if (e.latLng) void processCoordinates(e.latLng.lng(), e.latLng.lat());
            }}
            onZoomChanged={() => {
              const z = mapRef.current?.getZoom();
              if (z != null) setZoom(z);
            }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
          {selectedLand && typeof selectedLand.latitude === 'number' && typeof selectedLand.longitude === 'number' && (
            <Marker
              position={{ lat: selectedLand.latitude, lng: selectedLand.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#4a9eff',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          )}

          {lotPaths && (
            <Polygon
              paths={lotPaths}
              options={{
                fillColor: '#1e3a5f',
                fillOpacity: 0.25,
                strokeColor: '#4a9eff',
                strokeWeight: 2,
                strokeOpacity: 1,
                clickable: false,
              }}
            />
          )}

          {viewMode === '2D' &&
            houseFloorPlanGeoJSON?.features.map((f, i) => {
              const g = f.geometry;
              if (g.type !== 'Polygon') return null;
              const paths = ringToPath(g.coordinates[0] as number[][]);
              const room = (f.properties as { room?: number })?.room ?? i;
              return (
                <Polygon
                  key={`room-${i}`}
                  paths={paths}
                  options={{
                    fillColor: ROOM_COLORS[room % ROOM_COLORS.length],
                    fillOpacity: 0.85,
                    strokeColor: '#4a9eff',
                    strokeWeight: 1,
                    clickable: false,
                  }}
                />
              );
            })}

          {viewMode === '3D' && houseBaseGeoJSON && (
            <Polygon
              paths={ringToPath(houseBaseGeoJSON.geometry.coordinates[0] as number[][])}
              options={{
                fillColor: '#d8e4f0',
                fillOpacity: 0.85,
                strokeColor: '#64748b',
                strokeWeight: 1,
                clickable: false,
              }}
            />
          )}
          {viewMode === '3D' && houseRoofGeoJSON && (
            <Polygon
              paths={ringToPath(houseRoofGeoJSON.geometry.coordinates[0] as number[][])}
              options={{
                fillColor: '#2c3e50',
                fillOpacity: 0.95,
                strokeColor: '#475569',
                strokeWeight: 1,
                clickable: false,
              }}
            />
          )}
        </GoogleMap>
          {authFailure && (
            <div className={styles.mapBlockOverlay}>
              <GoogleMapsBlocked authFailure />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
