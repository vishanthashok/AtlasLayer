"use client";

export default function ParcelisError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0d1117', color: '#fca5a5', fontSize: '0.82rem', textAlign: 'center', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>Parcelis failed to load</div>
      <div style={{ opacity: 0.7 }}>{error.message}</div>
      <button onClick={reset} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, color: '#fca5a5', cursor: 'pointer' }}>Retry</button>
    </div>
  );
}
