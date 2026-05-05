'use client';

export function ConfidenceIndicator({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span style={{ color: '#5a6478', fontSize: '0.7rem' }}>Confidence —</span>;
  }
  let label = 'Low';
  let color = '#5a6478';
  if (value >= 0.75) {
    label = 'High';
    color = '#22d3a5';
  } else if (value >= 0.5) {
    label = 'Medium';
    color = '#fee08b';
  }

  return (
    <span
      title={`Confidence ${(value * 100).toFixed(0)}%`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.7rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} aria-hidden />
      {label} confidence
    </span>
  );
}
