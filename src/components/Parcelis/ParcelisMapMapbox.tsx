'use client';

import React, { useRef, useState, useCallback } from 'react';
import Map, { NavigationControl, Marker, Source, Layer } from 'react-map-gl/mapbox';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStore } from '../../store/useStore';
import { ZoomIn, ZoomOut, Scan, RotateCcw, Layers, Box } from 'lucide-react';
import styles from './ParcelisMap.module.css';
import BasemapToggle from '../maps/BasemapToggle';
import { buildHouseFootprintGeometries } from './houseFootprintGeometry';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface ParcelisMapMapboxProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export default function ParcelisMapMapbox({ onAnalyze, isAnalyzing }: ParcelisMapMapboxProps) {
  const mapRef = useRef<any>(null);
  const { selectedLand, setSelectedLand, viewMode, setViewMode, selectedHouseModel } = useStore();

  const [viewState, setViewState] = useState({
    longitude: -98.0,
    latitude: 38.0,
    zoom: 4,
    pitch: 0,
    bearing: 0,
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const zoom = (delta: number) => {
    setViewState((prev) => ({ ...prev, zoom: Math.min(22, Math.max(1, prev.zoom + delta)) }));
  };

  const reset3D = () => {
    setViewState((prev) => ({ ...prev, pitch: 0, bearing: 0 }));
    setViewMode('2D');
  };

  const toggle3D = () => {
    if (viewMode === '3D') {
      reset3D();
    } else {
      setViewMode('3D');
      setViewState((prev) => ({ ...prev, pitch: 55, bearing: -20, zoom: Math.max(prev.zoom, 18) }));
    }
  };

  const processCoordinates = useCallback(
    async (lng: number, lat: number) => {
      setLngInput(lng.toFixed(5));
      setLatInput(lat.toFixed(5));

      let address = 'Custom Location';
      if (MAPBOX_TOKEN) {
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
          );
          const data = await res.json();
          if (data.features?.length > 0) address = data.features[0].place_name;
        } catch {
          /* silent */
        }
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
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: 19,
        duration: 1400,
        pitch: viewMode === '3D' ? 55 : 0,
      });
    },
    [viewMode, setSelectedLand]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput || !MAPBOX_TOKEN) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchInput)}.json?access_token=${MAPBOX_TOKEN}`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        await processCoordinates(lng, lat);
      }
    } catch {
      /* silent */
    }
  };

  const handleCoordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) await processCoordinates(lng, lat);
  };

  const { houseBaseGeoJSON, houseRoofGeoJSON, houseFloorPlanGeoJSON } = buildHouseFootprintGeometries(
    selectedLand,
    selectedHouseModel
  );

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
        <button className={styles.mapBtn} onClick={() => zoom(1)} title="Zoom in">
          <ZoomIn size={15} />
        </button>
        <button className={styles.mapBtn} onClick={() => zoom(-1)} title="Zoom out">
          <ZoomOut size={15} />
        </button>
        <div className={styles.divider} />
        <button
          className={`${styles.mapBtn} ${viewMode === '3D' ? styles.mapBtnActive : ''}`}
          onClick={toggle3D}
          title="Toggle 3D"
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

      {!MAPBOX_TOKEN ? (
        <div className={styles.missingToken}>Missing NEXT_PUBLIC_MAPBOX_TOKEN</div>
      ) : (
        <Map
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onLoad={() => setMapLoaded(true)}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={(e) => processCoordinates(e.lngLat.lng, e.lngLat.lat)}
          ref={mapRef}
          attributionControl={false}
        >
          {mapLoaded &&
            selectedLand &&
            typeof selectedLand.longitude === 'number' &&
            typeof selectedLand.latitude === 'number' && (
              <Marker
                longitude={Number(selectedLand.longitude)}
                latitude={Number(selectedLand.latitude)}
                anchor="bottom"
              >
                <div className={styles.pinOuter}>
                  <div className={styles.pinInner} />
                </div>
              </Marker>
            )}

          {mapLoaded && selectedLand?.polygon && (
            <Source id="lot-src" type="geojson" data={selectedLand.polygon}>
              <Layer id="lot-fill" type="fill" paint={{ 'fill-color': '#1e3a5f', 'fill-opacity': 0.25 }} />
              <Layer
                id="lot-line"
                type="line"
                paint={{ 'line-color': '#4a9eff', 'line-width': 1.5, 'line-dasharray': [4, 3] }}
              />
            </Source>
          )}

          {mapLoaded && viewMode === '2D' && houseFloorPlanGeoJSON && (
            <Source id="floorplan-src" type="geojson" data={houseFloorPlanGeoJSON}>
              <Layer
                id="floorplan-fill"
                type="fill"
                paint={{
                  'fill-color': [
                    'match',
                    ['get', 'room'],
                    0,
                    '#1a3a5c',
                    1,
                    '#162e48',
                    2,
                    '#1a3a5c',
                    3,
                    '#0f2236',
                    '#1a3a5c',
                  ],
                  'fill-opacity': 0.85,
                }}
              />
              <Layer id="floorplan-line" type="line" paint={{ 'line-color': '#4a9eff', 'line-width': 1 }} />
            </Source>
          )}

          {mapLoaded && viewMode === '3D' && houseBaseGeoJSON && (
            <Source id="house-base-src" type="geojson" data={houseBaseGeoJSON}>
              <Layer
                id="house-walls"
                type="fill-extrusion"
                paint={{
                  'fill-extrusion-color': '#d8e4f0',
                  'fill-extrusion-height': 4.5,
                  'fill-extrusion-base': 0,
                  'fill-extrusion-opacity': 0.92,
                }}
              />
            </Source>
          )}
          {mapLoaded && viewMode === '3D' && houseRoofGeoJSON && (
            <Source id="house-roof-src" type="geojson" data={houseRoofGeoJSON}>
              <Layer
                id="house-roof"
                type="fill-extrusion"
                paint={{
                  'fill-extrusion-color': '#2c3e50',
                  'fill-extrusion-height': 7,
                  'fill-extrusion-base': 4.5,
                  'fill-extrusion-opacity': 1,
                }}
              />
            </Source>
          )}
        </Map>
      )}
    </div>
  );
}
