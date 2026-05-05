import { Land, HouseModel, AIAnalysisResult } from '../models/types';
import { useStore } from '../store/useStore';

export async function analyzeLand(land: Land, houseModels: HouseModel[]): Promise<AIAnalysisResult> {
  const model = useStore.getState().aiModel;
  const response = await fetch('/api/parcelis/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ land, houseModels, model }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  return {
    recommendedHouseTypes: data.recommendedHouseTypes || [],
    reasoningStrings: data.reasoningStrings || [],
    fitScorePerModel: data.fitScores || {},
    constraintsDetected: data.constraintsDetected || [],
    propertyIntelligence: data.propertyIntelligence ?? null,
    marketIntelligence: data.marketIntelligence ?? null,
    registryData: data.registryData ?? null,
    hazardProfile: data.hazardProfile ?? null,
    modelFeasibility: data.modelFeasibility ?? null,
    registryConnector: data.registryConnector ?? null,
    connectorErrors: data.connectorErrors ?? null,
    propertyData: data.propertyData ?? null,
  };
}

export async function matchHouseModels(land: Land, houseModels: HouseModel[]): Promise<{ranked: HouseModel[], analysis: AIAnalysisResult}> {
  const analysis = await analyzeLand(land, houseModels);

  const scoredModels = houseModels.map(model => ({
    ...model,
    estimatedFitScore: analysis.fitScorePerModel[model.id] ?? 0.5
  }));

  const ranked = scoredModels
    .sort((a, b) => (b.estimatedFitScore || 0) - (a.estimatedFitScore || 0))
    .slice(0, 5);

  return { ranked, analysis };
}
