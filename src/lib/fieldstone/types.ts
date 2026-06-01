export interface FieldstoneScores {
  profitability: number;
  risk: number;
  sustainability: number;
  overall: number;
}

export interface FieldstoneInsights {
  summary: string;
  risks: string[];
  crops: string[];
}

export interface FieldstoneEarthData {
  locationName: string;
  latitude: number;
  longitude: number;
  currentTempF: number;
  weeklyPrecip_in: number;
  soilMoisture: number;
  annualPrecip_in: number;
  avgTemp_F: number;
  avgHumidity: number;
  avgWind_mph: number;
  solarRad_MJ: number;
  droughtMonths: number;
  soilPH: number;
  organicCarbon: number;
  clayPct: number;
  sandPct: number;
  siltPct: number;
  soilTextureClass: string;
}

export interface FieldstoneAnalysisResult {
  stats: FieldstoneEarthData;
  scores: FieldstoneScores;
  riskScore: number;
  insights: FieldstoneInsights;
  mode: 'fast' | 'deep';
  _cached?: boolean;
}
