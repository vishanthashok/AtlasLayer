"use client";

import React from 'react';
import { useStore } from '../../store/useStore';
import { AIAnalysisResult, HouseModel } from '../../models/types';
import styles from './ParcelisPanel.module.css';
import {
  MapPin, AlertTriangle, Layers, Box, ChevronRight,
  Maximize2, LayoutGrid, Cpu, MessageSquare, Download,
  Droplets, ListOrdered,
} from 'lucide-react';
import ParcelisChat from './ParcelisChat';

interface Props {
  isAnalyzing: boolean;
  analysisResult: AIAnalysisResult | null;
  error?: string | null;
}

const STYLE_COLORS: Record<string, string> = {
  'Modern Townhome': '#3b82f6',
  'Ranch': '#10b981',
  'Colonial': '#8b5cf6',
  'Modern Farmhouse': '#f59e0b',
  'Bungalow': '#ec4899',
};


function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? '#22d3a5' : pct >= 55 ? '#4a9eff' : '#5a6478';
  return (
    <div className={styles.scoreBarWrapper}>
      <div className={styles.scoreBarTrack}>
        <div className={styles.scoreBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.scoreLabel} style={{ color }}>{pct}%</span>
    </div>
  );
}

function FloorPlanThumb({ model }: { model: HouseModel }) {
  // SVG blueprint-style floor plan thumbnail
  const { width, depth } = model.footprintDimensions;
  const aspect = width / depth;
  const svgW = 80, svgH = 80 / aspect;
  
  const rooms = model.styleType === 'Ranch' || model.styleType === 'Modern Farmhouse'
    ? [
        { x: 2, y: 2, w: svgW * 0.55 - 2, h: svgH * 0.5 - 2, label: 'LR' },
        { x: svgW * 0.55, y: 2, w: svgW * 0.45 - 2, h: svgH * 0.5 - 2, label: 'BR1' },
        { x: 2, y: svgH * 0.5, w: svgW * 0.35 - 2, h: svgH * 0.5 - 2, label: 'Kit' },
        { x: svgW * 0.35, y: svgH * 0.5, w: svgW * 0.35 - 2, h: svgH * 0.5 - 2, label: 'BR2' },
        { x: svgW * 0.7, y: svgH * 0.5, w: svgW * 0.3 - 2, h: svgH * 0.5 - 2, label: 'BA' },
      ]
    : [
        { x: 2, y: 2, w: svgW * 0.6 - 2, h: svgH * 0.45 - 2, label: 'LR' },
        { x: svgW * 0.6, y: 2, w: svgW * 0.4 - 2, h: svgH * 0.45 - 2, label: 'Kit' },
        { x: 2, y: svgH * 0.45, w: svgW * 0.5 - 2, h: svgH * 0.55 - 2, label: 'BR1' },
        { x: svgW * 0.5, y: svgH * 0.45, w: svgW * 0.3 - 2, h: svgH * 0.55 - 2, label: 'BR2' },
        { x: svgW * 0.8, y: svgH * 0.45, w: svgW * 0.2 - 2, h: svgH * 0.55 - 2, label: 'BA' },
      ];

  return (
    <svg width={80} height={Math.round(svgH)} viewBox={`0 0 ${svgW} ${svgH}`} className={styles.floorPlanSvg}>
      {/* Outer wall */}
      <rect x={0.5} y={0.5} width={svgW - 1} height={svgH - 1} fill="#0a1828" stroke="#4a9eff" strokeWidth={1.2} />
      {rooms.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(74,158,255,0.05)" stroke="rgba(74,158,255,0.3)" strokeWidth={0.5} />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 2.5} textAnchor="middle" fill="rgba(74,158,255,0.6)" fontSize={6} fontFamily="monospace">{r.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function ParcelisPanel({ isAnalyzing, analysisResult, error }: Props) {
  const { selectedLand, recommendationList, selectedHouseModel, setSelectedHouseModel, viewMode, setViewMode } = useStore();

  const registry = analysisResult?.registryConnector ?? null;

  const exportToHTML = () => {
    if (!analysisResult) return;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parcelis Export · PropertyVision — ${analysisResult.propertyIntelligence?.address || 'Report'}</title>
        <style>
          body { font-family: 'Inter', sans-serif; background: #0b0f15; color: #c8d6e8; padding: 40px; }
          .card { background: rgba(74, 158, 255, 0.04); border: 1px solid rgba(74, 158, 255, 0.15); padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          h1 { color: #4a9eff; }
          h2 { color: #22d3a5; font-size: 1.2rem; margin-top: 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .metric { display: flex; flex-direction: column; gap: 5px; }
          .label { font-size: 0.8rem; color: #7a8fa8; text-transform: uppercase; }
          .val { font-size: 1.1rem; font-weight: 600; color: #fff; }
          ul { padding-left: 20px; color: #94a3b8; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <h1>Parcelis Intelligence Report</h1>
        <div class="card">
          <h2>Property Details</h2>
          <div class="grid">
            <div class="metric"><span class="label">Address</span><span class="val">${analysisResult.propertyIntelligence?.address || 'N/A'}</span></div>
            <div class="metric"><span class="label">County</span><span class="val">${analysisResult.propertyIntelligence?.county || 'N/A'}</span></div>
            <div class="metric"><span class="label">Lot Size</span><span class="val">${analysisResult.propertyIntelligence?.lotSize_sqft || '0'} sqft</span></div>
            <div class="metric"><span class="label">Structure</span><span class="val">${analysisResult.propertyIntelligence?.existingStructure || 'N/A'}</span></div>
          </div>
        </div>
        <div class="card">
          <h2>Hazard &amp; site</h2>
          <div class="grid">
            <div class="metric"><span class="label">Flood zone</span><span class="val">${analysisResult.hazardProfile?.flood?.zone ?? 'N/A'}</span></div>
            <div class="metric"><span class="label">Elevation (ft)</span><span class="val">${analysisResult.hazardProfile?.elevation_ft ?? 'N/A'}</span></div>
            <div class="metric"><span class="label">Est. max slope</span><span class="val">${analysisResult.hazardProfile?.siteConstraints?.estimatedMaxSlopePercent != null ? analysisResult.hazardProfile.siteConstraints.estimatedMaxSlopePercent.toFixed(1) + '%' : 'N/A'}</span></div>
            <div class="metric"><span class="label">Zoning (OSM)</span><span class="val">${(analysisResult.hazardProfile?.zoningInference?.zoningTags || []).join(', ') || 'N/A'}</span></div>
          </div>
        </div>
        <div class="card">
          <h2>Market Intelligence</h2>
          <div class="grid">
            <div class="metric"><span class="label">Investment Rating</span><span class="val">${analysisResult.marketIntelligence?.investmentRating || 'N/A'}</span></div>
            <div class="metric"><span class="label">Appraised Value</span><span class="val">${analysisResult.registryData?.appraisedValue || 'N/A'}</span></div>
            <div class="metric"><span class="label">Owner Name</span><span class="val">${analysisResult.registryData?.ownerName || 'N/A'}</span></div>
            <div class="metric"><span class="label">Best Use</span><span class="val">${analysisResult.marketIntelligence?.bestUseStrategy || 'N/A'}</span></div>
          </div>
        </div>
        <div class="card">
          <h2>Model feasibility (ranked)</h2>
          <ol>
            ${(analysisResult.modelFeasibility?.ranked || [])
              .map(
                (r) =>
                  `<li><strong>#${r.rank} ${r.modelName}</strong> — ${Math.round(r.feasibilityScore * 100)}%${
                    r.blockers?.length
                      ? `<ul>${r.blockers.map((b: string) => `<li>${b}</li>`).join('')}</ul>`
                      : ''
                  }</li>`
              )
              .join('')}
          </ol>
        </div>
        <div class="card">
          <h2>Key Insights</h2>
          <ul>
            ${(analysisResult.reasoningStrings || []).map((s: string) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <h2>Constraints & Risks</h2>
          <ul>
            ${(analysisResult.constraintsDetected || []).map((s: string) => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Parcelis_Report_${(analysisResult.propertyIntelligence?.address || 'Unknown').replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.panel}>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTag}>PARCEL</span>
        <span className={styles.sectionLine} />
        {analysisResult && (
          <button onClick={exportToHTML} className={styles.exportBtn} title="Export Report to HTML">
            <Download size={12} /> Export HTML
          </button>
        )}
      </div>

      {!selectedLand ? (
        <div className={styles.emptyState}>
          <MapPin size={22} className={styles.emptyIcon} />
          <p>Click any location on the map to drop a pin and load parcel data.</p>
        </div>
      ) : (
        <div className={styles.parcelCard}>
          <div className={styles.parcelRow}>
            <MapPin size={12} className={styles.parcelIcon} />
            <span className={styles.parcelAddress}>{selectedLand.address || 'Custom Coordinates'}</span>
          </div>
          <div className={styles.parcelMeta}>
            <span>{(selectedLand.latitude || 0).toFixed(4)}°, {(selectedLand.longitude || 0).toFixed(4)}°</span>
            <span className={styles.parcelSize}>{selectedLand.estimatedLotSize?.toLocaleString() || 0} sqft</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isAnalyzing && (
        <div className={styles.errorCard}>
          <div className={styles.errorHeader}>
            <AlertTriangle size={14} />
            <span>INTELLIGENCE FAILURE</span>
          </div>
          <p>{error}</p>
          <div className={styles.errorHint}>
            Authentication failed. All AI-driven outputs require a valid ANTHROPIC_API_KEY. Please check your configuration.
          </div>
        </div>
      )}

      {/* AI Insights section */}
      {(isAnalyzing || analysisResult) && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>PROPERTY INTELLIGENCE</span>
            <span className={styles.sectionLine} />
          </div>

          {isAnalyzing ? (
            <div className={styles.loadingBlock}>
              <div className={styles.scanLine} />
              <Cpu size={14} className={styles.loadingIcon} />
              <span>Fetching Census · OSM · USGS · FEMA · RentCast · CAD · AI analysis...</span>
            </div>
          ) : analysisResult && (
            <div className={styles.insightBlock}>

              {/* Property Intelligence Card */}
              {analysisResult.propertyIntelligence && (
                <div className={styles.propertyCard}>
                  <div className={styles.propertyRow}>
                    <MapPin size={11} className={styles.propertyIcon} />
                    <div className={styles.propertyAddress}>
                      <strong>{analysisResult.propertyIntelligence.address}</strong>
                      <span>{analysisResult.propertyIntelligence.city}, {analysisResult.propertyIntelligence.state}</span>
                    </div>
                  </div>
                  <div className={styles.propertyGrid}>
                    <div className={styles.propertyCell}>
                      <span className={styles.propertyCellLabel}>COUNTY</span>
                      <span>{analysisResult.propertyIntelligence.county}</span>
                    </div>
                    <div className={styles.propertyCell}>
                      <span className={styles.propertyCellLabel}>LOT SIZE</span>
                      <span>{analysisResult.propertyIntelligence.lotSize_sqft?.toLocaleString()} sqft</span>
                    </div>
                    {analysisResult.propertyIntelligence.elevation_ft && (
                      <div className={styles.propertyCell}>
                        <span className={styles.propertyCellLabel}>ELEVATION</span>
                        <span>{analysisResult.propertyIntelligence.elevation_ft} ft</span>
                      </div>
                    )}
                    <div className={styles.propertyCell}>
                      <span className={styles.propertyCellLabel}>STRUCTURE</span>
                      <span>{analysisResult.propertyIntelligence.existingStructure}</span>
                    </div>
                    {analysisResult.propertyData?.existingStructure?.yearBuilt && analysisResult.propertyData.existingStructure.yearBuilt !== 'Unknown' && (
                      <div className={styles.propertyCell}>
                        <span className={styles.propertyCellLabel}>BUILT</span>
                        <span>{analysisResult.propertyData.existingStructure.yearBuilt}</span>
                      </div>
                    )}
                  </div>
                  {analysisResult.propertyIntelligence.publicRecordsNote && (
                    <p className={styles.publicRecordsNote}>{analysisResult.propertyIntelligence.publicRecordsNote}</p>
                  )}
                  {registry ? (
                    <a
                      href={registry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.ownerLookupBtn}
                      style={{ borderColor: '#22d3a5', color: '#22d3a5' }}
                    >
                      📡 {registry.name} Connector Active →
                    </a>
                  ) : (
                    <a
                      href={analysisResult.propertyIntelligence.ownerLookupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.ownerLookupBtn}
                    >
                      🔍 Look up owner &amp; tax records →
                    </a>
                  )}
                  {selectedLand?.address && (
                    <a
                      href={`/property?address=${encodeURIComponent(selectedLand.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.ownerLookupBtn}
                      style={{ borderColor: '#4a9eff', color: '#4a9eff' }}
                    >
                      View Official Property Data →
                    </a>
                  )}
                </div>
              )}

              {/* Official Registry Data */}
              {analysisResult.registryData && (
                <div className={styles.registrySection}>
                  <div className={styles.sectionHeaderSmall}>
                    <Layers size={11} />
                    <span>OFFICIAL REGISTRY DATA</span>
                  </div>
                  <div className={styles.registryGrid}>
                    <div className={styles.registryItem}>
                      <span className={styles.registryLabel}>OWNER</span>
                      <span className={styles.registryValue}>{analysisResult.registryData.ownerName}</span>
                    </div>
                    <div className={styles.registryItem}>
                      <span className={styles.registryLabel}>APPRAISED VALUE</span>
                      <span className={styles.registryValue} style={{color:'#22d3a5'}}>{analysisResult.registryData.appraisedValue}</span>
                    </div>
                    <div className={styles.registryItem}>
                      <span className={styles.registryLabel}>LEGAL DESCRIPTION</span>
                      <span className={styles.registryValue} style={{fontSize:'0.65rem', lineHeight:'1.2'}}>{analysisResult.registryData.legalDescription}</span>
                    </div>
                    <div className={styles.registryItem}>
                      <span className={styles.registryLabel}>LAST UPDATED</span>
                      <span className={styles.registryValue}>{analysisResult.registryData.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hazard & site constraints */}
              {analysisResult.hazardProfile && (
                <div className={styles.marketIntelligence}>
                  <div className={styles.sectionHeaderSmall}>
                    <Droplets size={11} />
                    <span>HAZARD &amp; SITE</span>
                  </div>
                  <div className={styles.marketGrid}>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>FLOOD ZONE</span>
                      <span className={styles.metricValue}>
                        {analysisResult.hazardProfile.flood.zone ?? '—'}{' '}
                        {analysisResult.hazardProfile.flood.inFloodZone && (
                          <span style={{ color: '#f59e0b' }}>(SFHA risk)</span>
                        )}
                      </span>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>ELEVATION</span>
                      <span className={styles.metricValue}>
                        {analysisResult.hazardProfile.elevation_ft != null
                          ? `${analysisResult.hazardProfile.elevation_ft} ft`
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>EST. MAX SLOPE</span>
                      <span className={styles.metricValue}>
                        {analysisResult.hazardProfile.siteConstraints.estimatedMaxSlopePercent != null
                          ? `${analysisResult.hazardProfile.siteConstraints.estimatedMaxSlopePercent.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>ZONING (OSM)</span>
                      <span className={styles.metricValue} style={{ fontSize: '0.65rem', lineHeight: 1.3 }}>
                        {(analysisResult.hazardProfile.zoningInference.zoningTags.length > 0
                          ? analysisResult.hazardProfile.zoningInference.zoningTags.slice(0, 2).join(', ')
                          : analysisResult.hazardProfile.zoningInference.landuseTags.slice(0, 2).join(', ')) || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#7a8fa8', marginTop: 8, lineHeight: 1.35 }}>
                    {analysisResult.hazardProfile.flood.disclaimer}{' '}
                    {analysisResult.hazardProfile.zoningInference.disclaimer}
                  </p>
                </div>
              )}

              {/* Market Intelligence */}
              {analysisResult.marketIntelligence && (
                <div className={styles.marketIntelligence}>
                  <div className={styles.sectionHeaderSmall}>
                    <Maximize2 size={11} />
                    <span>MARKET PREDICTION</span>
                    <span className={styles.investmentBadge} data-rating={analysisResult.marketIntelligence.investmentRating}>
                      RATING: {analysisResult.marketIntelligence.investmentRating}
                    </span>
                  </div>
                  
                  <div className={styles.marketGrid}>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>EST. MARKET VALUE</span>
                      <span className={styles.metricValue}>
                        ${((analysisResult.marketIntelligence?.estimatedValueRange?.min || 0)/1000).toFixed(0)}k - 
                        ${((analysisResult.marketIntelligence?.estimatedValueRange?.max || 0)/1000).toFixed(0)}k
                      </span>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>SELL VELOCITY</span>
                      <div className={styles.velocityRow}>
                        <ScoreBar score={analysisResult.marketIntelligence.sellVelocityScore / 10} />
                      </div>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>MIGRATION PROB.</span>
                      <span className={styles.metricValue}>{analysisResult.marketIntelligence?.migrationProbability ?? 0}%</span>
                    </div>
                    <div className={styles.marketMetric}>
                      <span className={styles.metricLabel}>RENTAL YIELD</span>
                      <span className={styles.metricValue} style={{color:'#4a9eff'}}>{analysisResult.marketIntelligence?.rentalYieldEstimate ?? 0}%</span>
                    </div>
                  </div>

                  <div className={styles.marketInsights}>
                    <strong>Best Use:</strong> {analysisResult.marketIntelligence.bestUseStrategy}
                  </div>
                </div>
              )}

              {/* Ranked model feasibility */}
              {analysisResult.modelFeasibility?.ranked && analysisResult.modelFeasibility.ranked.length > 0 && (
                <div className={styles.registrySection}>
                  <div className={styles.sectionHeaderSmall}>
                    <ListOrdered size={11} />
                    <span>MODEL FEASIBILITY</span>
                  </div>
                  <ol style={{ margin: '8px 0 0', paddingLeft: 18, color: '#94a3b8', fontSize: '0.75rem' }}>
                    {analysisResult.modelFeasibility.ranked.map((row) => (
                      <li key={row.modelId} style={{ marginBottom: 10 }}>
                        <strong style={{ color: '#e2e8f0' }}>
                          #{row.rank} {row.modelName}
                        </strong>{' '}
                        <span style={{ color: '#22d3a5' }}>{Math.round(row.feasibilityScore * 100)}%</span>
                        {row.blockers.length > 0 && (
                          <ul style={{ margin: '4px 0 0', paddingLeft: 14, listStyle: 'disc' }}>
                            {row.blockers.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {analysisResult.modelFeasibility?.synthesizedInsights &&
                analysisResult.modelFeasibility.synthesizedInsights.length > 0 && (
                  <div className={styles.constraintsBlock} style={{ borderColor: 'rgba(74,158,255,0.25)' }}>
                    <div className={styles.constraintsHeader}>
                      <Cpu size={11} />
                      <span>Synthesized insights</span>
                    </div>
                    <ul>
                      {analysisResult.modelFeasibility.synthesizedInsights.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Data sources */}
              <div className={styles.dataSources}>
                <span className={styles.dataSourceLabel}>SOURCES</span>
                <span className={styles.dataSourceBadge}>US Census</span>
                <span className={styles.dataSourceBadge}>OpenStreetMap</span>
                <span className={styles.dataSourceBadge}>USGS</span>
                <span className={styles.dataSourceBadge} style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.25)' }}>
                  FEMA NFHL
                </span>
                <span className={styles.dataSourceBadge} style={{color:'#4a9eff', borderColor:'rgba(74,158,255,0.2)'}}>RentCast</span>
                {registry && <span className={styles.dataSourceBadge} style={{color:'#22d3a5', borderColor:'rgba(34,211,165,0.2)'}}>{registry.name}</span>}
                <span className={styles.dataSourceBadge}>{error ? 'Heuristic Fallback' : 'Claude AI'}</span>
              </div>

              <ul className={styles.reasoningList}>
                {(analysisResult.reasoningStrings || []).map((s: string, i: number) => (
                  <li key={i}>
                    <ChevronRight size={10} className={styles.chevron} />
                    {s}
                  </li>
                ))}
              </ul>

              {analysisResult.constraintsDetected?.length > 0 && (
                <div className={styles.constraintsBlock}>
                  <div className={styles.constraintsHeader}>
                    <AlertTriangle size={11} />
                    <span>Constraints Detected</span>
                  </div>
                  <ul>
                    {analysisResult.constraintsDetected.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.recommendedHouseTypes?.length > 0 && (
                <div className={styles.tagRow}>
                  {analysisResult.recommendedHouseTypes.map((t: string, i: number) => (
                    <span key={i} className={styles.typeTag} style={{ borderColor: STYLE_COLORS[t] || '#4a9eff', color: STYLE_COLORS[t] || '#4a9eff' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* AI Chat Bot */}
      {(isAnalyzing || analysisResult) && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>CHAT</span>
            <span className={styles.sectionLine} />
          </div>
          <ParcelisChat analysisResult={analysisResult} />
        </>
      )}
    </div>
  );
}
