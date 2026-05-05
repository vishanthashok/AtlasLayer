"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './DashboardPanel.module.css';
import { Download, AlertTriangle, Droplets, Thermometer, MapPin, Terminal, Send, BookmarkPlus, FolderOpen, ChevronDown, ChevronUp, Trash2, CheckCircle, Zap, FlaskConical, SlidersHorizontal, TrendingUp, TrendingDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';

const FIELDSTONE_PORTFOLIO_KEY = 'fieldstone_portfolio';
const LEGACY_AGRIMAP_PORTFOLIO_KEY = 'agrimap_portfolio';

interface DashboardPanelProps {
  hasPolygon: boolean;
  isAnalyzing: boolean;
  onAnalyze: (scenarioOverrides?: any) => void;
  result: any;
  analysisMode: 'fast' | 'deep';
  onModeChange: (mode: 'fast' | 'deep') => void;
}

// ── Score Bar Component ──────────────────────────────────────────
function ScoreBar({ label, value, max = 10, invert = false }: { label: string; value: number; max?: number; invert?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  const effectivePct = invert ? 100 - pct : pct;
  const color = effectivePct > 66 ? '#00e5ff' : effectivePct > 33 ? '#eab308' : '#ef4444';
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreBarTop}>
        <span className={styles.scoreLabel}>{label}</span>
        <span className={styles.scoreValue} style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Delta Indicator ─────────────────────────────────────────────
function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return null;
  return (
    <span className={diff > 0 ? styles.deltaUp : styles.deltaDown}>
      {diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
    </span>
  );
}

export default function DashboardPanel({ hasPolygon, isAnalyzing, onAnalyze, result, analysisMode, onModeChange }: DashboardPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevResult = useRef<any>(null);

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'scenario' | 'portfolio'>('analysis');
  const [savedParcels, setSavedParcels] = useState<any[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  // Scenario simulation state
  const [rainfallMultiplier, setRainfallMultiplier] = useState(1.0);
  const [tempOffset, setTempOffset] = useState(0);
  const [scenarioSoil, setScenarioSoil] = useState('');
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const QUICK_PROMPTS = [
    "Identify optimal irrigation schedule",
    "List 3 alternative drought-resistant crops",
    "Analyze economic viability for corn here"
  ];

  useEffect(() => {
    let saved = localStorage.getItem(FIELDSTONE_PORTFOLIO_KEY);
    if (!saved) saved = localStorage.getItem(LEGACY_AGRIMAP_PORTFOLIO_KEY);
    if (saved) {
      try { setSavedParcels(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
  }, []);

  // Track previous result for insight diffing
  useEffect(() => {
    if (result) {
      // Store old result before overwriting
      prevResult.current = prevResult.current === null ? null : prevResult.current;
    }
  }, []);

  const handleAnalyzeClick = () => {
    prevResult.current = result;
    onAnalyze();
  };

  const handleRunScenario = async () => {
    if (!result) return;
    setIsSimulating(true);
    const overrides: any = {};
    if (rainfallMultiplier !== 1.0) overrides.rainfallMultiplier = rainfallMultiplier;
    if (tempOffset !== 0) overrides.tempOffset = tempOffset;
    if (scenarioSoil) overrides.soilType = scenarioSoil;
    onAnalyze(overrides);
    // The result will update via the parent — for now show scenario tab result
    setIsSimulating(false);
  };

  const handleChat = async (promptOverride?: string) => {
    const finalPrompt = promptOverride || chatPrompt;
    if (!finalPrompt || !result) return;
    setIsChatting(true);
    setChatResponse(null);
    try {
      const res = await fetch('/api/fieldstone/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, context: result.stats })
      });
      const data = await res.json();
      setChatResponse(data.response || `Error: ${data.error}`);
    } catch (e) {
      setChatResponse("Connection failed. Please try again.");
    }
    setIsChatting(false);
    setChatPrompt("");
  };

  const handleSaveToPortfolio = () => {
    if (!result) return;
    const newSaved = [...savedParcels, { ...result, savedAt: new Date().toISOString() }];
    setSavedParcels(newSaved);
    localStorage.setItem(FIELDSTONE_PORTFOLIO_KEY, JSON.stringify(newSaved));
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleDeleteParcel = (idx: number) => {
    const updated = savedParcels.filter((_, i) => i !== idx);
    setSavedParcels(updated);
    localStorage.setItem(FIELDSTONE_PORTFOLIO_KEY, JSON.stringify(updated));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const handleExport = () => {
    if (!result) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("Fieldstone · PropertyVision Report", 20, 20);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${new Date().toLocaleString()} | Mode: ${result.mode?.toUpperCase() || 'DEEP'}`, 20, 28);
      if (result.stats?.locationName) {
        const locLines = pdf.splitTextToSize(`Location: ${result.stats.locationName}`, 170);
        pdf.text(locLines, 20, 35);
      }
      pdf.setLineWidth(0.5);
      pdf.line(20, 44, 190, 44);

      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Land Scores", 20, 52);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      if (result.scores) {
        pdf.text(`Profitability: ${result.scores.profitability}/10`, 20, 60);
        pdf.text(`Risk: ${result.scores.risk}/10`, 20, 67);
        pdf.text(`Sustainability: ${result.scores.sustainability}/10`, 20, 74);
        pdf.text(`Overall: ${result.scores.overall}/10`, 20, 81);
      }
      pdf.line(20, 87, 190, 87);

      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Environmental Data", 20, 95);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      pdf.text(`Rainfall: ${result.stats.avgRainfall.toFixed(2)}"  |  Temp: ${result.stats.avgTemp.toFixed(1)}°F  |  Soil: ${result.stats.dominantSoil}`, 20, 103);
      pdf.line(20, 109, 190, 109);

      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("AI Strategy & Insights", 20, 117);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      const summaryLines = pdf.splitTextToSize(result.insights?.summary || '', 170);
      pdf.text(summaryLines, 20, 125);
      let y = 125 + summaryLines.length * 6 + 6;

      pdf.setFont("helvetica", "bold"); pdf.text("Top Risks:", 20, y); y += 7;
      pdf.setFont("helvetica", "normal");
      result.insights?.risks?.forEach((r: string) => { pdf.text(`• ${r}`, 25, y); y += 7; });
      y += 4;
      pdf.setFont("helvetica", "bold"); pdf.text("Recommended Crops:", 20, y); y += 7;
      pdf.setFont("helvetica", "normal");
      result.insights?.crops?.forEach((c: string) => { pdf.text(`• ${c}`, 25, y); y += 7; });

      pdf.save('Fieldstone_Report.pdf');
    } catch (err) { console.error("Export failed", err); }
  };

  const prevScores = prevResult.current?.scores;
  const displayResult = result;

  return (
    <div className={styles.container} ref={panelRef}>
      {/* Tab Bar */}
      <div className={styles.tabNav}>
        <button className={`${styles.tabBtn} ${activeTab === 'analysis' ? styles.activeTab : ''}`} onClick={() => setActiveTab('analysis')}>
          Analysis
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'scenario' ? styles.activeTab : ''}`} onClick={() => setActiveTab('scenario')}>
          <SlidersHorizontal size={13} /> Simulate
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'portfolio' ? styles.activeTab : ''}`} onClick={() => setActiveTab('portfolio')}>
          Portfolio ({savedParcels.length})
        </button>
      </div>

      {/* ── PORTFOLIO TAB ── */}
      {activeTab === 'portfolio' && (
        <div className={styles.portfolioContainer}>
          {savedParcels.length === 0 ? (
            <div className={styles.emptyState}>
              <FolderOpen size={48} className={styles.emptyIcon} />
              <h2>Portfolio Empty</h2>
              <p>Save analysis reports to view them here later.</p>
            </div>
          ) : (
            <div className={styles.portfolioList}>
              {savedParcels.map((parcel, idx) => {
                const isExpanded = expandedIdx === idx;
                const riskColor = parcel.riskScore > 7 ? '#ef4444' : parcel.riskScore > 4 ? '#eab308' : '#00e5ff';
                return (
                  <div key={idx} className={`${styles.portfolioCard} ${isExpanded ? styles.portfolioCardExpanded : ''}`}>
                    <div className={styles.portfolioHeader} onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                      <div className={styles.portfolioTitleGroup}>
                        <MapPin size={14} style={{ color: '#00e5ff', flexShrink: 0 }} />
                        <h4>{parcel.stats?.locationName || `Parcel ${idx + 1}`}</h4>
                      </div>
                      <div className={styles.portfolioHeaderRight}>
                        <span className={styles.portfolioDate}>{new Date(parcel.savedAt).toLocaleDateString()}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                    <div className={styles.portfolioStats}>
                      <span style={{ color: riskColor }}>Risk {parcel.scores?.risk?.toFixed(1) ?? parcel.riskScore?.toFixed(1)}/10</span>
                      <span>Profit {parcel.scores?.profitability?.toFixed(1) ?? '—'}/10</span>
                      <span>Soil {parcel.stats?.soilTextureClass ?? parcel.stats?.dominantSoil}</span>
                      <span>Temp {(parcel.stats?.avgTemp_F ?? parcel.stats?.avgTemp)?.toFixed(0)}°F</span>
                    </div>
                    {isExpanded && (
                      <div className={styles.portfolioExpanded}>
                        <div className={styles.portfolioSection}>
                          <div className={styles.portfolioSectionLabel}>COORDINATES / LOCATION</div>
                          <p className={styles.portfolioCoords}>{parcel.stats?.locationName}</p>
                        </div>
                        <div className={styles.portfolioSection}>
                          <div className={styles.portfolioSectionLabel}>AI STRATEGY SUMMARY</div>
                          <p className={styles.portfolioFullSummary}>{parcel.insights?.summary}</p>
                        </div>
                        {parcel.insights?.risks?.length > 0 && (
                          <div className={styles.portfolioSection}>
                            <div className={styles.portfolioSectionLabel}>TOP RISKS</div>
                            <ul className={styles.portfolioRiskList}>
                              {parcel.insights.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                        {parcel.insights?.crops?.length > 0 && (
                          <div className={styles.portfolioSection}>
                            <div className={styles.portfolioSectionLabel}>RECOMMENDED CROPS</div>
                            <div className={styles.cropTags}>
                              {parcel.insights.crops.map((c: string, i: number) => (
                                <span key={i} className={styles.cropTag}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button className={styles.deleteParcelBtn} onClick={() => handleDeleteParcel(idx)}>
                          <Trash2 size={13} /> Remove from Portfolio
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCENARIO SIMULATION TAB ── */}
      {activeTab === 'scenario' && (
        <div className={styles.scenarioContainer}>
          {!result ? (
            <div className={styles.emptyState}>
              <SlidersHorizontal size={48} className={styles.emptyIcon} />
              <h2>Run Analysis First</h2>
              <p>Draw a parcel and run an analysis to enable scenario simulation.</p>
            </div>
          ) : (
            <>
              <div className={styles.scenarioHeader}>
                <span className={styles.scenarioTitle}>WHAT-IF SCENARIO SIMULATOR</span>
                <span className={styles.scenarioSubtitle}>Adjust parameters to model different conditions</span>
              </div>

              <div className={styles.scenarioSliders}>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <Droplets size={14} color="#00e5ff" />
                    <span>Rainfall</span>
                    <span className={styles.sliderVal}>{rainfallMultiplier >= 1 ? '+' : ''}{Math.round((rainfallMultiplier - 1) * 100)}%</span>
                  </div>
                  <input type="range" min="0.3" max="2.0" step="0.05"
                    value={rainfallMultiplier}
                    onChange={e => setRainfallMultiplier(parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                  <div className={styles.sliderTicks}><span>−70%</span><span>Baseline</span><span>+100%</span></div>
                </div>

                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <Thermometer size={14} color="#eab308" />
                    <span>Temperature</span>
                    <span className={styles.sliderVal}>{tempOffset >= 0 ? '+' : ''}{tempOffset}°F</span>
                  </div>
                  <input type="range" min="-20" max="20" step="1"
                    value={tempOffset}
                    onChange={e => setTempOffset(parseInt(e.target.value))}
                    className={styles.slider}
                  />
                  <div className={styles.sliderTicks}><span>−20°F</span><span>Baseline</span><span>+20°F</span></div>
                </div>

                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <MapPin size={14} color="#8b949e" />
                    <span>Soil Type Override</span>
                  </div>
                  <select
                    className={styles.scenarioSelect}
                    value={scenarioSoil}
                    onChange={e => setScenarioSoil(e.target.value)}
                  >
                    <option value="">— Use detected soil —</option>
                    <option value="Loam">Loam (Best)</option>
                    <option value="Clay Loam">Clay Loam (Medium)</option>
                    <option value="Sandy Loam">Sandy Loam (Poor retention)</option>
                  </select>
                </div>
              </div>

              <button
                className={styles.scenarioRunBtn}
                onClick={handleRunScenario}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Simulating...' : '⚡ Run Scenario (Fast Mode)'}
              </button>

              <button
                className={styles.scenarioResetBtn}
                onClick={() => { setRainfallMultiplier(1.0); setTempOffset(0); setScenarioSoil(''); }}
              >
                Reset to Baseline
              </button>

              {result.scores && (
                <div className={styles.scenarioCurrentScores}>
                  <div className={styles.scenarioScoreLabel}>CURRENT SCORES (baseline)</div>
                  <ScoreBar label="Profitability" value={result.scores.profitability} />
                  <ScoreBar label="Risk (lower=better)" value={result.scores.risk} invert />
                  <ScoreBar label="Sustainability" value={result.scores.sustainability} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ANALYSIS TAB ── */}
      {activeTab === 'analysis' && (
        <>
          <div className={styles.header}>
            <div>
              <h2>Land Analysis</h2>
              {result?.mode && (
                <span className={result.mode === 'deep' ? styles.modeDeepBadge : styles.modeFastBadge}>
                  {result.mode === 'deep' ? '🔬 Deep' : result.mode === 'fast_fallback' ? '⚡ Fast (fallback)' : '⚡ Fast'}
                </span>
              )}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {savedToast && <span className={styles.savedToast}><CheckCircle size={13} /> Saved!</span>}
                <button className={styles.exportBtn} onClick={handleSaveToPortfolio}><BookmarkPlus size={16} /> Save</button>
                <button className={styles.exportBtn} onClick={handleExport}><Download size={16} /> Export</button>
              </div>
            )}
          </div>

          {/* Mode Toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${analysisMode === 'fast' ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('fast')}
            >
              <Zap size={13} /> Fast
            </button>
            <button
              className={`${styles.modeBtn} ${analysisMode === 'deep' ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('deep')}
            >
              <FlaskConical size={13} /> Deep AI
            </button>
          </div>

          {!result ? (
            <div className={styles.actionArea}>
              {!hasPolygon ? (
                <div className={styles.emptyState}>
                  <MapPin size={48} className={styles.emptyIcon} />
                  <h3>Draw a Parcel</h3>
                  <p>Use the polygon tool on the map to select a land area for analysis.</p>
                </div>
              ) : (
                <button className={styles.analyzeBtn} onClick={handleAnalyzeClick} disabled={isAnalyzing}>
                  {isAnalyzing ? 'Processing...' : 'Run Analysis Pipeline'}
                </button>
              )}
            </div>
          ) : (
            <div className={styles.resultsArea}>

              {/* Location */}
              {result.stats?.locationName && (
                <div className={styles.locationBanner}>
                  <MapPin size={12} />
                  <span>{result.stats.locationName}</span>
                </div>
              )}

              {/* 4-Dimension Score System */}
              {result.scores && (
                <div className={styles.scoresPanel}>
                  <div className={styles.scoresPanelHeader}>
                    <span>LAND SCORES</span>
                    <span className={styles.overallScore} style={{
                      color: result.scores.overall > 6.5 ? '#00e5ff' : result.scores.overall > 4 ? '#eab308' : '#ef4444'
                    }}>
                      Overall {result.scores.overall}/10
                      <Delta current={result.scores.overall} previous={prevScores?.overall} />
                    </span>
                  </div>
                  <ScoreBar label="Profitability" value={result.scores.profitability} />
                  <Delta current={result.scores.profitability} previous={prevScores?.profitability} />
                  <ScoreBar label="Risk (lower = better)" value={result.scores.risk} invert />
                  <Delta current={result.scores.risk} previous={prevScores?.risk} />
                  <ScoreBar label="Sustainability" value={result.scores.sustainability} />
                  <Delta current={result.scores.sustainability} previous={prevScores?.sustainability} />
                </div>
              )}

              {/* Stats Grid — real data from NASA POWER + SoilGrids */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <Droplets className={styles.statIcon} color="#58a6ff" />
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Annual Rainfall</span>
                    <span className={styles.statValue}>{(result.stats.annualPrecip_in ?? result.stats.avgRainfall)?.toFixed(1)}"</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <Thermometer className={styles.statIcon} color="#d29922" />
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Avg Temp (22yr)</span>
                    <span className={styles.statValue}>{(result.stats.avgTemp_F ?? result.stats.avgTemp)?.toFixed(1)}°F</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <AlertTriangle className={styles.statIcon} color={result.scores?.risk > 6 ? "#f85149" : "#2ea043"} />
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Dry Months/yr</span>
                    <span className={styles.statValue}>{result.stats.droughtMonths ?? result.stats.avgDroughtFreq ?? '—'}</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <MapPin className={styles.statIcon} color="#8b949e" />
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Soil Texture</span>
                    <span className={styles.statValue} style={{ fontSize: '0.9rem' }}>{result.stats.soilTextureClass ?? result.stats.dominantSoil}</span>
                  </div>
                </div>
                {result.stats.soilPH != null && (
                  <div className={styles.statCard}>
                    <span className={styles.statIcon} style={{fontSize:'13px',fontWeight:700,color:'#a78bfa'}}>pH</span>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Soil pH</span>
                      <span className={styles.statValue}>{result.stats.soilPH}</span>
                    </div>
                  </div>
                )}
                {result.stats.organicCarbon != null && (
                  <div className={styles.statCard}>
                    <span className={styles.statIcon} style={{fontSize:'11px',fontWeight:700,color:'#34d399'}}>OC</span>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Organic Carbon</span>
                      <span className={styles.statValue}>{result.stats.organicCarbon} g/kg</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Sources */}
              <div className={styles.dataSources}>
                <span className={styles.dataSourceLabel}>DATA SOURCES</span>
                <span className={styles.dataSourceBadge}>NASA POWER</span>
                <span className={styles.dataSourceBadge}>ISRIC SoilGrids</span>
                <span className={styles.dataSourceBadge}>Open-Meteo</span>
                <span className={styles.dataSourceBadge}>Mapbox Geocoder</span>
              </div>

              {/* AI Insights */}
              <div className={styles.glassPanel}>
                <h3>AI Insights</h3>
                <div className={styles.insightContent}>
                  <p className={styles.summary}>{result.insights?.summary}</p>
                  <div className={styles.insightSection}>
                    <h4>Top Risks</h4>
                    <ul>{result.insights?.risks?.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                  </div>
                  <div className={styles.insightSection}>
                    <h4>Recommended Crops</h4>
                    <div className={styles.cropTags}>
                      {result.insights?.crops?.map((c: string, i: number) => (
                        <span key={i} className={styles.cropTag}>{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* INTELLIGENCE_NODE */}
              <div className={styles.commandModule}>
                <div className={styles.commandHeader}>
                  <Terminal size={14} className={styles.commandIcon} />
                  <span>INTELLIGENCE_NODE // QUERY</span>
                </div>
                <div className={styles.quickPrompts}>
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button key={idx} className={styles.quickPromptBtn} onClick={() => handleChat(qp)} disabled={isChatting}>
                      {qp}
                    </button>
                  ))}
                </div>
                <div className={styles.commandInputWrapper}>
                  <span className={styles.commandPromptChar}>&gt;</span>
                  <input
                    type="text" className={styles.commandInput}
                    placeholder="Enter custom parameter query..."
                    value={chatPrompt}
                    onChange={e => setChatPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChat()}
                    disabled={isChatting}
                  />
                  <button className={styles.commandSendBtn} onClick={() => handleChat()} disabled={isChatting || !chatPrompt}>
                    <Send size={14} />
                  </button>
                </div>
                {isChatting && <div className={styles.commandResponse}><span className={styles.blinkingCursor}>_</span> Processing query...</div>}
                {chatResponse && !isChatting && (
                  <div className={styles.commandResponse}>
                    <div className={styles.responseHeader}>ANALYSIS_COMPLETE:</div>
                    <div className={styles.responseText}><ReactMarkdown>{chatResponse}</ReactMarkdown></div>
                  </div>
                )}
              </div>

              <button className={styles.analyzeBtn} onClick={handleAnalyzeClick} disabled={isAnalyzing}>
                {isAnalyzing ? 'Processing...' : 'Recalibrate Scanners'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
