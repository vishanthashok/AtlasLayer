import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';
import { z } from 'zod';
import { cacheGet, cacheSet } from '../../../../lib/property-intelligence/cache';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ScenarioSchema = z.object({
  rainfallMultiplier: z.number().min(0).max(10).optional(),
  tempOffset: z.number().min(-50).max(50).optional(),
  soilType: z.string().max(50).optional(),
}).optional();

const BodySchema = z.object({
  polygon: z.object({
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
  }),
  mode: z.enum(['fast', 'deep']).optional().default('deep'),
  scenarioOverrides: ScenarioSchema,
});

// ── Soil texture classification from clay/sand %
function classifySoil(clay: number, sand: number): string {
  if (clay > 40) return 'Clay';
  if (sand > 70 && clay < 15) return 'Sandy Loam';
  if (clay > 27 && sand < 45) return 'Clay Loam';
  if (clay > 20 && sand > 25) return 'Loam';
  if (sand > 52 && clay < 18) return 'Sandy Loam';
  return 'Loam';
}

// ── Compute 4-dimension scores from real data
function computeScores(data: any) {
  const { annualPrecip_in, avgTemp_F, droughtMonths, soilPH, organicCarbon, clayPct, sandPct } = data;

  // Profitability: ideal rain 20-50in, temp 55-75F, good pH, high OC
  const rainScore = Math.min(10, Math.max(0, 10 - Math.abs(annualPrecip_in - 35) / 4));
  const tempScore = Math.min(10, Math.max(0, 10 - Math.abs(avgTemp_F - 65) / 3));
  const phScore = Math.min(10, Math.max(0, 10 - Math.abs(soilPH - 6.5) * 3));
  const ocScore = Math.min(10, organicCarbon / 3);
  const profitability = Math.round(((rainScore + tempScore + phScore + ocScore) / 4) * 10) / 10;

  // Risk: drought months + extreme temp + very sandy or clay soil
  const droughtRisk = Math.min(10, droughtMonths * 1.2);
  const tempRisk = Math.min(5, Math.abs(avgTemp_F - 65) / 5);
  const soilRisk = (sandPct > 70 || clayPct > 50) ? 3 : 0;
  const risk = Math.round(Math.min(10, Math.max(0, droughtRisk * 0.5 + tempRisk * 0.3 + soilRisk * 0.2)) * 10) / 10;

  // Sustainability: low drought, good OC, balanced texture
  const sustainability = Math.round(Math.min(10, Math.max(0, 10 - droughtRisk * 0.4 + ocScore * 0.6 - soilRisk * 0.2)) * 10) / 10;
  const overall = Math.round(((profitability + (10 - risk) + sustainability) / 3) * 10) / 10;

  return { profitability, risk, sustainability, overall };
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    const { polygon, mode, scenarioOverrides } = parsed.data;

    const coordinates = polygon.coordinates[0];
    const centerLon = coordinates.reduce((s, c) => s + c[0], 0) / coordinates.length;
    const centerLat = coordinates.reduce((s, c) => s + c[1], 0) / coordinates.length;

    // ── 1. Reverse Geocode
    let locationName = `Lat: ${centerLat.toFixed(4)}, Lon: ${centerLon.toFixed(4)}`;
    if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      try {
        const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${centerLon},${centerLat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.features?.length > 0) {
            locationName = `${geoData.features[0].place_name} (${centerLat.toFixed(4)}, ${centerLon.toFixed(4)})`;
          }
        }
      } catch (e) { /* fallback to coords */ }
    }

    // ── 2. Fetch all real data sources in parallel
    const [meteoData, nasaData, soilData] = await Promise.allSettled([
      // Open-Meteo: current conditions + 7-day forecast
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${centerLat}&longitude=${centerLon}&current=temperature_2m,soil_moisture_0_to_7cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`).then(r => r.json()),
      // NASA POWER: 22-year climate normals (free, no key)
      fetch(`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR,T2M,RH2M,WS10M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${centerLon}&latitude=${centerLat}&format=JSON`).then(r => r.json()),
      // SoilGrids ISRIC: real soil composition (free, no key)
      fetch(`https://rest.soilgrids.org/soilgrids/v2.0/properties/query?lon=${centerLon}&lat=${centerLat}&property=phh2o&property=soc&property=clay&property=sand&property=silt&depth=0-30cm&value=mean`).then(r => r.json()),
    ]);

    // ── 3. Parse real data
    let currentTempF = 65, soilMoisture = 0.2, weeklyPrecip_in = 0;
    if (meteoData.status === 'fulfilled' && meteoData.value?.daily) {
      const d = meteoData.value.daily;
      const avgTempC = d.temperature_2m_max.reduce((a: number, b: number, i: number) => a + (b + d.temperature_2m_min[i]) / 2, 0) / d.temperature_2m_max.length;
      currentTempF = (avgTempC * 9 / 5) + 32;
      weeklyPrecip_in = d.precipitation_sum.reduce((a: number, b: number) => a + b, 0) / 25.4;
      soilMoisture = meteoData.value.current?.soil_moisture_0_to_7cm ?? 0.2;
    }

    let annualPrecip_in = 25, avgTemp_F = currentTempF, avgHumidity = 60, avgWind_mph = 8, solarRad = 15, droughtMonths = 2;
    if (nasaData.status === 'fulfilled' && nasaData.value?.properties?.parameter) {
      const p = nasaData.value.properties.parameter;
      annualPrecip_in = (p.PRECTOTCORR?.ANN ?? 0) * 365 / 25.4; // mm/day × 365 → mm/yr ÷ 25.4 → inches/yr
      avgTemp_F = ((p.T2M?.ANN ?? 18) * 9 / 5) + 32;
      avgHumidity = p.RH2M?.ANN ?? 60;
      avgWind_mph = (p.WS10M?.ANN ?? 3.5) * 2.237;
      solarRad = p.ALLSKY_SFC_SW_DWN?.ANN ?? 15;
      // Count dry months (avg < 1mm/day = ~0.04in/day)
      droughtMonths = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        .filter(m => (p.PRECTOTCORR?.[m] ?? 99) < 1).length;
    }

    let soilPH = 6.5, organicCarbon = 10, clayPct = 25, sandPct = 40, siltPct = 35, soilTextureClass = 'Loam';
    if (soilData.status === 'fulfilled' && soilData.value?.properties?.layers) {
      const layers = soilData.value.properties.layers;
      const getVal = (name: string, factor = 1) => {
        const layer = layers.find((l: any) => l.name === name);
        const val = layer?.depths?.[0]?.values?.mean;
        return val != null ? val / factor : null;
      };
      soilPH = getVal('phh2o', 10) ?? 6.5;
      organicCarbon = getVal('soc', 10) ?? 10; // dg/kg → g/kg
      clayPct = getVal('clay', 10) ?? 25;  // g/kg ÷ 10 → %
      sandPct = getVal('sand', 10) ?? 40;
      siltPct = getVal('silt', 10) ?? 35;
      soilTextureClass = classifySoil(clayPct, sandPct);
    }

    // Apply scenario overrides
    if (scenarioOverrides?.rainfallMultiplier) annualPrecip_in *= scenarioOverrides.rainfallMultiplier;
    if (scenarioOverrides?.tempOffset) avgTemp_F += scenarioOverrides.tempOffset;
    if (scenarioOverrides?.soilType) soilTextureClass = scenarioOverrides.soilType;

    const earthData = {
      locationName,
      latitude: centerLat, longitude: centerLon,
      // Current
      currentTempF: Math.round(currentTempF * 10) / 10,
      weeklyPrecip_in: Math.round(weeklyPrecip_in * 100) / 100,
      soilMoisture: Math.round(soilMoisture * 1000) / 1000,
      // NASA 22-yr normals
      annualPrecip_in: Math.round(annualPrecip_in * 10) / 10,
      avgTemp_F: Math.round(avgTemp_F * 10) / 10,
      avgHumidity: Math.round(avgHumidity),
      avgWind_mph: Math.round(avgWind_mph * 10) / 10,
      solarRad_MJ: Math.round(solarRad * 10) / 10,
      droughtMonths,
      // SoilGrids
      soilPH: Math.round(soilPH * 10) / 10,
      organicCarbon: Math.round(organicCarbon * 10) / 10,
      clayPct: Math.round(clayPct),
      sandPct: Math.round(sandPct),
      siltPct: Math.round(siltPct),
      soilTextureClass,
    };

    const scores = computeScores(earthData);

    // ── 4. Fast mode: real data, no Claude
    if (mode === 'fast' || !process.env.ANTHROPIC_API_KEY) {
      const crops = soilTextureClass === 'Clay' ? ['Rice', 'Cotton', 'Sorghum']
        : soilTextureClass === 'Sandy Loam' ? ['Peanuts', 'Watermelon', 'Sweet Potato']
        : annualPrecip_in > 30 ? ['Corn', 'Soybeans', 'Winter Wheat']
        : ['Sorghum', 'Sunflower', 'Milo'];

      return NextResponse.json({
        stats: earthData, scores, riskScore: scores.risk, mode: 'fast',
        insights: {
          summary: `[Fast Mode] ${locationName.split('(')[0].trim()} — ${earthData.annualPrecip_in}" annual rainfall, ${earthData.avgTemp_F}°F avg. Soil: ${soilTextureClass} (pH ${soilPH}, ${organicCarbon}g/kg organic carbon). ${droughtMonths} dry months/yr.`,
          risks: [
            droughtMonths > 4 ? `${droughtMonths} dry months/yr — drip irrigation essential` : 'Seasonal dry periods require irrigation monitoring',
            avgTemp_F > 85 ? `High heat stress (${avgTemp_F}°F) — select heat-tolerant varieties` : 'Temperature within manageable range',
            soilPH < 5.5 ? 'Acidic soil (pH ' + soilPH + ') — lime application needed' : soilPH > 7.5 ? 'Alkaline soil — sulfur amendments may be required' : 'Soil pH near optimal range',
          ],
          crops,
        }
      });
    }

    // ── 5. Deep mode: Claude with full real data
    const cacheKey = `fieldstone:deep:${crypto.createHash('sha256').update(JSON.stringify(earthData) + '_v6_deep').digest('hex')}`;
    const cachedInsights = await cacheGet<{ summary: string; risks: string[]; crops: string[] }>(cacheKey);
    if (cachedInsights) {
      return NextResponse.json({ stats: earthData, scores, riskScore: scores.risk, insights: cachedInsights, mode: 'deep', _cached: true });
    }

    const prompt = `You are an expert agricultural scientist and land analyst with access to real satellite and climate data.

LOCATION: ${locationName}
COORDINATES: ${centerLat.toFixed(4)}°N, ${centerLon.toFixed(4)}°W

── NASA POWER 22-YEAR CLIMATE NORMALS ──
• Annual precipitation: ${annualPrecip_in.toFixed(1)} inches/year
• Mean annual temperature: ${avgTemp_F.toFixed(1)}°F
• Average relative humidity: ${avgHumidity}%
• Average wind speed: ${avgWind_mph.toFixed(1)} mph
• Solar radiation: ${solarRad.toFixed(1)} MJ/m²/day
• Climatologically dry months/year: ${droughtMonths}

── OPEN-METEO CURRENT CONDITIONS ──
• Current 7-day temperature: ${currentTempF.toFixed(1)}°F
• 7-day accumulated precipitation: ${weeklyPrecip_in.toFixed(2)} inches
• Topsoil moisture (0–7cm): ${(soilMoisture * 100).toFixed(1)}% volumetric

── ISRIC SOILGRIDS REAL SOIL DATA ──
• Soil pH: ${soilPH}
• Organic carbon: ${organicCarbon} g/kg
• Clay: ${clayPct}% | Sand: ${sandPct}% | Silt: ${siltPct}%
• Derived texture class: ${soilTextureClass}

── COMPUTED LAND SCORES ──
• Profitability: ${scores.profitability}/10
• Risk: ${scores.risk}/10
• Sustainability: ${scores.sustainability}/10

Based on this real-world data from NASA, ISRIC SoilGrids, and Open-Meteo, generate a deep agricultural intelligence report for this exact parcel:
1. A precise farming strategy (max 90 words) referencing the actual climate and soil values above
2. Top 3 risks with specific values cited and actionable mitigation steps
3. Top 3 crop recommendations with justification tied to the actual data

Return ONLY a raw JSON object, no markdown, no backticks:
{"summary":"string","risks":["string","string","string"],"crops":["string","string","string"]}`;

    let insightsResponse: { summary: string; risks: string[]; crops: string[] } | undefined;
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        temperature: 0.15,
        system: 'You are an agricultural AI that outputs ONLY valid JSON. Never use markdown or backticks.',
        messages: [{ role: 'user', content: prompt }]
      });
      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      insightsResponse = JSON.parse(clean) as { summary: string; risks: string[]; crops: string[] };
      await cacheSet(cacheKey, insightsResponse, 60 * 60 * 24);
    } catch (e) {
      console.error('Claude error:', e);
      insightsResponse = {
        summary: `Real data analysis for ${locationName.split('(')[0].trim()}: ${annualPrecip_in.toFixed(0)}" annual rain, ${avgTemp_F.toFixed(0)}°F avg, ${soilTextureClass} soil (pH ${soilPH}). ${droughtMonths} climatological dry months indicate ${droughtMonths > 4 ? 'high' : 'moderate'} irrigation dependency.`,
        risks: ['Claude analysis failed — using raw data fallback', `${droughtMonths} dry months require proactive irrigation planning`, `Soil pH ${soilPH} — verify fertilizer compatibility`],
        crops: ['Wheat', 'Corn', 'Soybeans']
      };
    }

    return NextResponse.json({ stats: earthData, scores, riskScore: scores.risk, insights: insightsResponse, mode: 'deep' });

  } catch (error: unknown) {
    console.error('Analyze error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to analyze land';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
