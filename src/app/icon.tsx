import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0a0e1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Globe rings */}
        <div style={{
          width: 20, height: 20,
          border: '2px solid #00d4ff',
          borderRadius: '50%',
          position: 'absolute',
          opacity: 0.9,
          display: 'flex',
        }} />
        <div style={{
          width: 20, height: 8,
          border: '1.5px solid #00d4ff',
          borderRadius: '50%',
          position: 'absolute',
          opacity: 0.5,
          display: 'flex',
        }} />
        {/* Crosshair */}
        <div style={{ width: 20, height: 1.5, background: '#00d4ff', position: 'absolute', opacity: 0.6, display: 'flex' }} />
        <div style={{ width: 1.5, height: 20, background: '#00d4ff', position: 'absolute', opacity: 0.6, display: 'flex' }} />
        {/* Center dot */}
        <div style={{ width: 4, height: 4, background: '#ff3b3b', borderRadius: '50%', position: 'absolute', display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}
