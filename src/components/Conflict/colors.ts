import { scaleSequential } from 'd3-scale';
import { interpolateRdYlGn } from 'd3-scale-chromatic';

const interpolator = scaleSequential(interpolateRdYlGn).domain([1, 0]);

/** 0 → green, 1 → red (RdYlGn reversed). NaN/out-of-range falls back to neutral grey. */
export function scoreToColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '#1f2937';
  return interpolator(Math.max(0, Math.min(1, score))) as string;
}

export const RISK_BUCKETS: Array<{ label: string; min: number; cssVar: string; hex: string }> = [
  { label: 'Low', min: 0, cssVar: 'var(--risk-0)', hex: '#1a9850' },
  { label: 'Moderate', min: 0.25, cssVar: 'var(--risk-25)', hex: '#91cf60' },
  { label: 'Elevated', min: 0.5, cssVar: 'var(--risk-50)', hex: '#fee08b' },
  { label: 'High', min: 0.75, cssVar: 'var(--risk-75)', hex: '#fc8d59' },
  { label: 'Critical', min: 0.9, cssVar: 'var(--risk-100)', hex: '#d73027' },
];

/** Mapbox-paint-friendly hex stops (CSS vars cannot be used in paint expressions). */
export const RISK_HEX_STOPS: Array<[number, string]> = [
  [0, '#1a9850'],
  [0.25, '#91cf60'],
  [0.5, '#fee08b'],
  [0.75, '#fc8d59'],
  [1, '#d73027'],
];

export const LEVEL_LABEL: Record<number, string> = {
  1: 'Exercise Normal Precautions',
  2: 'Exercise Increased Caution',
  3: 'Reconsider Travel',
  4: 'Do Not Travel',
};

export const LEVEL_COLOR_VAR: Record<number, string> = {
  1: 'var(--level-1)',
  2: 'var(--level-2)',
  3: 'var(--level-3)',
  4: 'var(--level-4)',
};
