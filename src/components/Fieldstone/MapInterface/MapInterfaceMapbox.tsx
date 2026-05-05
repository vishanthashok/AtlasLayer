'use client';

import React, { useRef, useState, useCallback } from 'react';
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
// @ts-expect-error no types
import DrawRectangle from 'mapbox-gl-draw-rectangle-mode';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import BasemapToggle from '../../maps/BasemapToggle';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const getGibsDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().split('T')[0];
};

interface MapInterfaceMapboxProps {
  selectedLayer: 'rainfall' | 'temp' | 'soil' | 'drought' | 'ndvi' | 'flood';
  onPolygonChange: (polygon: GeoJSON.Polygon | null) => void;
}

export default function MapInterfaceMapbox({ selectedLayer, onPolygonChange }: MapInterfaceMapboxProps) {
  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [gibsDate] = useState(getGibsDate());
  const [hasDrawn, setHasDrawn] = useState(false);

  const [viewState, setViewState] = useState({
    longitude: -120.0,
    latitude: 37.0,
    zoom: 6,
  });

  const handlePresetClick = (lon: number, lat: number, zoom: number = 9) => {
    mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 2000 });
  };

  const updateArea = useCallback(() => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      if (data.features.length > 1) {
        const toDelete = data.features.slice(0, data.features.length - 1).map((f) => f.id as string);
        drawRef.current.delete(toDelete);
      }
      setHasDrawn(true);
      onPolygonChange(data.features[data.features.length - 1].geometry as GeoJSON.Polygon);
    } else {
      setHasDrawn(false);
      onPolygonChange(null);
    }
  }, [onPolygonChange]);

  const onMapLoad = useCallback(
    (e: { target: mapboxgl.Map }) => {
      const map = e.target;

      const modes = { ...MapboxDraw.modes } as Record<string, unknown>;
      modes.draw_polygon = DrawRectangle;

      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        modes: modes as any,
        defaultMode: 'simple_select',
      });

      map.addControl(drawRef.current, 'top-left');

      const geocoder = new MapboxGeocoder({
        accessToken: MAPBOX_TOKEN,
        mapboxgl: mapboxgl as any,
        marker: false,
      });
      map.addControl(geocoder, 'top-right');

      map.on('draw.create', () => {
        setTimeout(() => drawRef.current?.changeMode('simple_select'), 0);
        updateArea();
      });
      map.on('draw.delete', updateArea);
      map.on('draw.update', updateArea);
    },
    [updateArea]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        .mapboxgl-ctrl-logo { display: none !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
      `}</style>
      <div style={{ position: 'absolute', bottom: '24px', left: '10px', zIndex: 2 }}>
        <BasemapToggle />
      </div>
      {!MAPBOX_TOKEN ? (
        <div style={{ padding: '2rem', color: '#f85149', textAlign: 'center' }}>
          <h3>Missing Mapbox Token</h3>
          <p>Please add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file</p>
        </div>
      ) : (
        <Map
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/satellite-v9"
          mapboxAccessToken={MAPBOX_TOKEN}
          onLoad={onMapLoad}
          ref={mapRef}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" />

          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
              zIndex: 1,
              backgroundColor: 'rgba(13, 17, 23, 0.8)',
              padding: '8px',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)',
              border: '1px solid #30363d',
            }}
          >
            <button
              type="button"
              onClick={() => handlePresetClick(-121.6555, 36.6777)}
              style={{
                padding: '6px 12px',
                background: '#21262d',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Salinas Valley
            </button>
            <button
              type="button"
              onClick={() => handlePresetClick(-119.8871, 36.3302)}
              style={{
                padding: '6px 12px',
                background: '#21262d',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Central Valley
            </button>
            <button
              type="button"
              onClick={() => handlePresetClick(-93.6091, 41.6005)}
              style={{
                padding: '6px 12px',
                background: '#21262d',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Iowa Corn Belt
            </button>
            <button
              type="button"
              onClick={() => handlePresetClick(-101.8313, 35.222)}
              style={{
                padding: '6px 12px',
                background: '#21262d',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Texas Panhandle
            </button>
          </div>

          {hasDrawn && (
            <button
              type="button"
              onClick={() => {
                drawRef.current?.deleteAll();
                setHasDrawn(false);
                onPolygonChange(null);
              }}
              style={{
                position: 'absolute',
                top: '50px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                backgroundColor: '#da3633',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              }}
            >
              Clear Selected Area
            </button>
          )}

          {selectedLayer === 'rainfall' && (
            <Source
              id="rainfall-source"
              type="raster"
              tiles={[
                'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi?service=WMS&request=GetMap&version=1.1.1&layers=nexrad-n0q-900913&styles=&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}',
              ]}
              tileSize={256}
            >
              <Layer id="rainfall-layer" type="raster" paint={{ 'raster-opacity': 0.6 }} />
            </Source>
          )}

          {selectedLayer === 'temp' && (
            <Source
              id="temp-source"
              type="raster"
              tiles={[
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
              ]}
              tileSize={256}
            >
              <Layer id="temp-layer" type="raster" paint={{ 'raster-opacity': 0.4 }} />
            </Source>
          )}

          {selectedLayer === 'ndvi' && (
            <Source
              id="ndvi-source"
              type="raster"
              tiles={[
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
              ]}
              tileSize={256}
            >
              <Layer id="ndvi-layer" type="raster" paint={{ 'raster-opacity': 0.65 }} />
            </Source>
          )}

          {selectedLayer === 'flood' && (
            <Source
              id="flood-source"
              type="raster"
              tiles={[
                'https://hazards.fema.gov/gis/nfhl/services/public/NFHL/MapServer/WMSServer?service=WMS&request=GetMap&version=1.1.1&layers=0&styles=&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}',
              ]}
              tileSize={256}
            >
              <Layer id="flood-layer" type="raster" paint={{ 'raster-opacity': 0.6 }} />
            </Source>
          )}
        </Map>
      )}
    </div>
  );
}
