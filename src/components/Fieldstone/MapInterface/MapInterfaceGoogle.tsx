'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager } from '@react-google-maps/api';
import BasemapToggle from '../../maps/BasemapToggle';
import GoogleMapsBlocked from '../../maps/GoogleMapsBlocked';
import { googleForwardGeocode } from '../../../lib/maps/googleGeocode';
import {
  PROPERTYVISION_GOOGLE_MAPS_LIBRARIES,
  PROPERTYVISION_GOOGLE_MAPS_SCRIPT_ID,
  PROPERTYVISION_GOOGLE_MAPS_VERSION,
  subscribeGoogleMapsAuthFailure,
} from '../../../lib/maps/googleMapsLoader';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface MapInterfaceGoogleProps {
  selectedLayer: 'rainfall' | 'temp' | 'soil' | 'drought' | 'ndvi' | 'flood';
  onPolygonChange: (polygon: GeoJSON.Polygon | null) => void;
}

const mapContainerStyle: React.CSSProperties = { width: '100%', height: '100%' };

function rectangleToPolygon(rect: google.maps.Rectangle): GeoJSON.Polygon {
  const b = rect.getBounds();
  if (!b) {
    return { type: 'Polygon', coordinates: [] };
  }
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  const coords: number[][] = [
    [sw.lng(), sw.lat()],
    [ne.lng(), sw.lat()],
    [ne.lng(), ne.lat()],
    [sw.lng(), ne.lat()],
    [sw.lng(), sw.lat()],
  ];
  return { type: 'Polygon', coordinates: [coords] };
}

function polygonOverlayToGeoJson(poly: google.maps.Polygon): GeoJSON.Polygon {
  const path = poly.getPath();
  const coords: number[][] = [];
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i);
    coords.push([p.lng(), p.lat()]);
  }
  if (coords.length > 1) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      coords.push([first[0], first[1]]);
    }
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export default function MapInterfaceGoogle({ selectedLayer, onPolygonChange }: MapInterfaceGoogleProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [center] = useState({ lat: 37.0, lng: -120.0 });
  const [zoom, setZoom] = useState(6);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [searchInput, setSearchInput] = useState('');
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

  const overlayUnavailable =
    selectedLayer === 'rainfall' ||
    selectedLayer === 'temp' ||
    selectedLayer === 'ndvi' ||
    selectedLayer === 'flood';

  const handlePresetClick = (lon: number, lat: number, z: number = 9) => {
    mapRef.current?.panTo({ lat, lng: lon });
    mapRef.current?.setZoom(z);
    setZoom(z);
  };

  const applyPolygon = useCallback(
    (geom: GeoJSON.Polygon) => {
      setHasDrawn(true);
      onPolygonChange(geom);
    },
    [onPolygonChange]
  );

  const onRectangleComplete = useCallback(
    (rect: google.maps.Rectangle) => {
      applyPolygon(rectangleToPolygon(rect));
      rect.setMap(null);
    },
    [applyPolygon]
  );

  const onPolygonComplete = useCallback(
    (poly: google.maps.Polygon) => {
      applyPolygon(polygonOverlayToGeoJson(poly));
      poly.setMap(null);
    },
    [applyPolygon]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || !GOOGLE_KEY) return;
    const r = await googleForwardGeocode(searchInput.trim(), GOOGLE_KEY);
    if (r) {
      mapRef.current?.panTo({ lat: r.lat, lng: r.lng });
      mapRef.current?.setZoom(11);
      setZoom(11);
      setSearchInput('');
    }
  };

  const clearDrawing = () => {
    setHasDrawn(false);
    onPolygonChange(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: '24px', left: '10px', zIndex: 2 }}>
        <BasemapToggle />
      </div>

      {overlayUnavailable && (
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            backgroundColor: 'rgba(13, 17, 23, 0.92)',
            color: '#e6edf3',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #30363d',
            fontSize: '12px',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          Weather and hazard raster overlays are only available on the Mapbox basemap. Switch to Mapbox to view this
          layer on the map.
        </div>
      )}

      <form
        onSubmit={handleSearch}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 2,
          display: 'flex',
          gap: '6px',
          backgroundColor: 'rgba(13, 17, 23, 0.85)',
          padding: '6px',
          borderRadius: '6px',
          border: '1px solid #30363d',
        }}
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search place..."
          style={{
            width: '180px',
            background: '#0d1117',
            border: '1px solid #30363d',
            color: '#e6edf3',
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
        <button
          type="submit"
          style={{
            background: '#21262d',
            border: '1px solid #30363d',
            color: '#e6edf3',
            padding: '6px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Go
        </button>
      </form>

      {!GOOGLE_KEY ? (
        <div style={{ padding: '2rem', color: '#f85149', textAlign: 'center' }}>
          <h3>Missing Google Maps API Key</h3>
          <p>Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.</p>
        </div>
      ) : loadError ? (
        <div
          style={{
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
          }}
        >
          <GoogleMapsBlocked loadError={loadError} authFailure={false} />
        </div>
      ) : !isLoaded ? (
        <div style={{ padding: '2rem', color: '#8b949e', textAlign: 'center' }}>Loading map…</div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={zoom}
            mapTypeId={google.maps.MapTypeId.HYBRID}
            onLoad={(map) => {
              mapRef.current = map;
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
          <DrawingManager
            options={{
              drawingControl: true,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
                drawingModes: [
                  google.maps.drawing.OverlayType.RECTANGLE,
                  google.maps.drawing.OverlayType.POLYGON,
                ],
              },
              rectangleOptions: {
                fillColor: '#4a9eff',
                fillOpacity: 0.25,
                strokeWeight: 2,
                clickable: false,
              },
              polygonOptions: {
                fillColor: '#4a9eff',
                fillOpacity: 0.25,
                strokeWeight: 2,
                clickable: false,
              },
            }}
            onRectangleComplete={onRectangleComplete}
            onPolygonComplete={onPolygonComplete}
          />
        </GoogleMap>
          {authFailure && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 40,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '1rem',
                background: 'rgba(6, 9, 14, 0.92)',
                overflow: 'auto',
              }}
            >
              <GoogleMapsBlocked authFailure />
            </div>
          )}
        </div>
      )}

      {isLoaded && (
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
      )}

      {hasDrawn && isLoaded && (
        <button
          type="button"
          onClick={clearDrawing}
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
    </div>
  );
}
