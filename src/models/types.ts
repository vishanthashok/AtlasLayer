export interface Land {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  polygon?: any; // GeoJSON polygon
  estimatedLotSize?: number; // in sq ft
  orientationAngle?: number; // 0 to 360
}

export interface HouseModel {
  id: string;
  name: string;
  footprintDimensions: { width: number; depth: number }; // in meters or feet. Let's say feet.
  styleType: string;
  estimatedFitScore?: number; // 0 to 1
  renderAssetUrl?: string; // Placeholder or model url
  description?: string;
}

export interface AIAnalysisResult {
  recommendedHouseTypes: string[];
  reasoningStrings: string[];
  fitScorePerModel: Record<string, number>;
  constraintsDetected: string[];
  propertyIntelligence?: {
    address: string;
    city: string;
    state: string;
    county: string;
    coordinates: string;
    lotSize_sqft: number;
    elevation_ft: number | null;
    existingStructure: string;
    ownerLookupUrl: string;
    publicRecordsNote?: string;
  };
  marketIntelligence?: {
    estimatedValueRange: { min: number, max: number };
    sellVelocityScore: number; // 1-10
    migrationProbability: number; // percentage
    rentalYieldEstimate: number; // percentage
    demandDrivers: string[];
    investmentRating: 'AAA' | 'AA' | 'A' | 'B' | 'C';
    bestUseStrategy: string;
  };
  registryData?: {
    ownerName: string;
    appraisedValue: string;
    legalDescription: string;
    lastUpdated: string;
    source: string;
    provenance?: { owner?: string; value?: string };
  };
  hazardProfile?: {
    flood: {
      inFloodZone: boolean;
      zone: string | null;
      zoneDescription: string | null;
      baseFloodElevation_ft?: number | null;
      source: string;
      disclaimer: string;
    };
    elevation_ft: number | null;
    siteConstraints: {
      estimatedMaxSlopePercent: number | null;
      slopeMethod: string;
      notes: string[];
    };
    zoningInference: {
      landuseTags: string[];
      zoningTags: string[];
      countyZoningHint: string | null;
      confidence: 'high' | 'medium' | 'low';
      disclaimer?: string;
    };
  };
  modelFeasibility?: {
    ranked: {
      modelId: string;
      modelName: string;
      rank: number;
      feasibilityScore: number;
      blockers: string[];
      notes?: string;
    }[];
    synthesizedInsights: string[];
  };
  registryConnector?: { name: string; url: string } | null;
  connectorErrors?: Record<string, string>;
  propertyData?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string; // Plain text or JSON string representing structured response
  parsedContent?: {
    text: string;
    graph?: {
      title: string;
      type: 'bar' | 'line';
      data: any[];
      xAxisKey: string;
      yAxisKey: string;
    };
  };
  timestamp: string;
}
