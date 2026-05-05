/**
 * On-device “ML” risk scorer: logistic blend of State Dept level (prior),
 * NLP signals from advisory full text, and supplemental news/social aggregates.
 * No external inference API — deterministic, auditable weights.
 */
import { extractConflictIndicators } from '../nlp/conflictExtractor';
import { analyzeSentiment } from '../nlp/sentiment';

/** Maps official advisory level (1–4) to a 0–1 prior (violence / insecurity). */
const LEVEL_PRIOR: Record<number, number> = {
  1: 0.12,
  2: 0.38,
  3: 0.72,
  4: 0.96,
};

const NO_LEVEL_PRIOR = 0.07;

export interface MlSignalBreakdown {
  advisory_level_prior: number;
  advisory_text_conflict: number;
  advisory_sentiment_risk: number;
  news_risk: number;
  social_risk: number;
  /** Raw linear score before sigmoid (for debugging). */
  logit: number;
}

/** Negative advisory sentiment → higher risk (0–1). */
export function sentimentCompoundToRisk(compound: number): number {
  const c = Math.max(-1, Math.min(1, compound));
  return Math.max(0, Math.min(1, (1 - c) / 2));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Single unified violence/insecurity score in [0, 1].
 * Higher = more dangerous per U.S. travel advisory + text signals + feeds.
 */
export function computeMlViolenceScore(params: {
  stateDeptLevel: number | null;
  advisoryFullText: string | null | undefined;
  advisoryHeadline: string | null | undefined;
  newsRisk01: number;
  socialRisk01: number;
}): { score: number; breakdown: MlSignalBreakdown } {
  const level = params.stateDeptLevel;
  const levelPrior =
    level != null && level >= 1 && level <= 4
      ? LEVEL_PRIOR[level] ?? NO_LEVEL_PRIOR
      : NO_LEVEL_PRIOR;

  const blob = [
    params.advisoryHeadline ?? '',
    params.advisoryFullText ?? '',
  ]
    .join('\n')
    .slice(0, 12000);

  const extraction = extractConflictIndicators(blob);
  const textConflict = Math.max(0, Math.min(1, extraction.score));

  const sent = analyzeSentiment(blob);
  const sentimentRisk = sentimentCompoundToRisk(sent);

  const newsR = Math.max(0, Math.min(1, params.newsRisk01));
  const socR = Math.max(0, Math.min(1, params.socialRisk01));

  // Hand-calibrated logits (interpretable linear layer + sigmoid).
  const logit =
    -0.35 +
    2.4 * levelPrior +
    1.15 * Math.max(textConflict, sentimentRisk * 0.95) +
    0.55 * newsR +
    0.28 * socR;

  const score = Math.max(0, Math.min(1, Number(sigmoid(logit).toFixed(4))));

  return {
    score,
    breakdown: {
      advisory_level_prior: Number(levelPrior.toFixed(4)),
      advisory_text_conflict: Number(textConflict.toFixed(4)),
      advisory_sentiment_risk: Number(sentimentRisk.toFixed(4)),
      news_risk: Number(newsR.toFixed(4)),
      social_risk: Number(socR.toFixed(4)),
      logit: Number(logit.toFixed(4)),
    },
  };
}

/** Travel “safety” 0–100 where higher is safer (inverse of violence score). */
export function violenceToSafetyScore(violence01: number): number {
  const v = Math.max(0, Math.min(1, violence01));
  return Math.round((1 - v) * 100);
}
