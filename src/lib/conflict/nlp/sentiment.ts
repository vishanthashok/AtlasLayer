import Sentiment from 'sentiment';

const analyzer = new Sentiment();

/**
 * VADER-equivalent sentiment via the `sentiment` npm package.
 * Returns a compound score in [-1, 1]. Score is normalized off the comparative
 * field, which scales by token count.
 */
export function analyzeSentiment(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.slice(0, 5000);
  try {
    const result = analyzer.analyze(trimmed);
    const compound = result.comparative;
    if (!Number.isFinite(compound)) return 0;
    return Math.max(-1, Math.min(1, compound));
  } catch {
    return 0;
  }
}
