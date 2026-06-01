"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import dynamic from 'next/dynamic';
import DashboardPanel from '../../components/Fieldstone/DashboardPanel/DashboardPanel';
import CommandPalette, { CommandAction } from '../../components/Fieldstone/CommandPalette/CommandPalette';
import { Toast } from '../../components/ui/Toast';
import { Layers, ArrowLeft, Map, Droplets, Thermometer, Wind, Activity, BarChart2, Zap, FlaskConical, Command } from 'lucide-react';
import Link from 'next/link';
import type { FieldstoneAnalysisResult } from '../../lib/fieldstone/types';

// Dynamically import MapInterface with ssr: false
const MapInterface = dynamic(() => import('../../components/Fieldstone/MapInterface/MapInterface'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading Map...</div>
});

type LayerType = 'rainfall' | 'temp' | 'soil' | 'drought' | 'ndvi' | 'flood';

export default function FieldstonePage() {
  const router = useRouter();
  const [selectedLayer, setSelectedLayer] = useState<LayerType>('drought');
  const [polygonData, setPolygonData] = useState<GeoJSON.Polygon | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FieldstoneAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('deep');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'map' | 'panel'>('map');

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePolygonChange = (polygon: GeoJSON.Polygon | null) => {
    setPolygonData(polygon);
    if (!polygon) setAnalysisResult(null);
  };

  const handleAnalyze = useCallback(async (scenarioOverrides?: Record<string, unknown>) => {
    if (!polygonData) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/fieldstone/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon: polygonData, mode: analysisMode, scenarioOverrides })
      });
      const data = await response.json();
      if (!response.ok) {
        setToastMsg(data.error || 'An error occurred during analysis');
        return;
      }
      setAnalysisResult(data as FieldstoneAnalysisResult);
    } catch (error) {
      console.error("Failed to analyze:", error);
      setToastMsg("Failed to connect to the server.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [polygonData, analysisMode]);

  // Define all palette commands
  const paletteActions: CommandAction[] = [
    // Layer switching
    { id: 'layer-drought', label: 'Switch to Drought Layer', description: 'Toggle drought frequency overlay', icon: <Activity size={15} />, category: 'Layers', action: () => setSelectedLayer('drought'), keywords: ['drought', 'dry'] },
    { id: 'layer-rainfall', label: 'Switch to Rainfall Layer', description: 'NEXRAD precipitation radar overlay', icon: <Droplets size={15} />, category: 'Layers', action: () => setSelectedLayer('rainfall'), keywords: ['rain', 'precipitation', 'water'] },
    { id: 'layer-temp', label: 'Switch to Temperature Layer', description: 'NASA MODIS land surface temperature', icon: <Thermometer size={15} />, category: 'Layers', action: () => setSelectedLayer('temp'), keywords: ['temperature', 'heat', 'thermal', 'modis'] },
    { id: 'layer-soil', label: 'Switch to Soil Layer', description: 'Soil classification overlay', icon: <Map size={15} />, category: 'Layers', action: () => setSelectedLayer('soil'), keywords: ['soil', 'ground', 'earth'] },
    { id: 'layer-ndvi', label: 'Switch to NDVI Layer', description: 'NASA MODIS vegetation index', icon: <Layers size={15} />, category: 'Layers', action: () => setSelectedLayer('ndvi'), keywords: ['ndvi', 'vegetation', 'crop health', 'green'] },
    { id: 'layer-flood', label: 'Switch to Flood Risk Layer', description: 'FEMA national flood hazard zones', icon: <Wind size={15} />, category: 'Layers', action: () => setSelectedLayer('flood'), keywords: ['flood', 'fema', 'hazard', 'water risk'] },
    // Analysis
    { id: 'analyze-fast', label: 'Run Fast Analysis', description: 'Instant heuristic scoring — no API tokens', icon: <Zap size={15} />, category: 'Analysis', action: () => { setAnalysisMode('fast'); if (polygonData) handleAnalyze(); }, keywords: ['fast', 'quick', 'instant'] },
    { id: 'analyze-deep', label: 'Run Deep AI Analysis', description: 'Full Claude agricultural intelligence', icon: <FlaskConical size={15} />, category: 'Analysis', action: () => { setAnalysisMode('deep'); if (polygonData) handleAnalyze(); }, keywords: ['deep', 'ai', 'claude', 'full'] },
    { id: 'mode-fast', label: 'Set Mode: Fast', description: 'Future analyses will use Fast mode', icon: <Zap size={15} />, category: 'Analysis', action: () => setAnalysisMode('fast'), keywords: ['mode'] },
    { id: 'mode-deep', label: 'Set Mode: Deep AI', description: 'Future analyses will use Deep AI mode', icon: <FlaskConical size={15} />, category: 'Analysis', action: () => setAnalysisMode('deep'), keywords: ['mode'] },
    // Navigation
    { id: 'nav-home', label: 'Go to Hub', description: 'Return to AtlasLayer platform selection', icon: <ArrowLeft size={15} />, category: 'Navigation', action: () => router.push('/'), keywords: ['home', 'hub', 'back'] },
    { id: 'nav-parcelis', label: 'Open Parcelis', description: 'Switch to real estate parcel intelligence', icon: <Map size={15} />, category: 'Navigation', action: () => router.push('/parcelis'), keywords: ['parcel', 'real estate', 'residential'] },
    // Export
    { id: 'export-pdf', label: 'Export PDF Report', description: 'Download structured intelligence report', icon: <BarChart2 size={15} />, category: 'Export', action: () => setToastMsg('Use the Export button in the Analysis panel.'), keywords: ['pdf', 'download', 'report', 'export'] },
  ];

  return (
    <div className={styles.workspace}>
      {/* Global Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />

      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to Hub
        </Link>
        <div className={styles.titleBlock}>
          <span className={styles.titleBrand}>ATLASLAYER</span>
          <span className={styles.title}>Fieldstone</span>
        </div>
        
        <div className={styles.layerControls}>
          {(['drought','rainfall','temp','soil','ndvi','flood'] as const).map(layer => (
            <button
              key={layer}
              className={`${styles.layerBtn} ${selectedLayer === layer ? styles.active : ''}`}
              onClick={() => setSelectedLayer(layer)}
            >
              {layer === 'ndvi' ? 'NDVI' : layer === 'flood' ? 'Flood Risk' : layer.charAt(0).toUpperCase() + layer.slice(1)}
            </button>
          ))}
        </div>

        {/* ⌘K button in header */}
        <button className={styles.cmdBtn} onClick={() => setPaletteOpen(true)}>
          <Command size={14} />
          <span>⌘K</span>
        </button>
      </header>
      
      <div className={styles.mobileTabs}>
        <button
          className={`${styles.mobileTab} ${mobileTab === 'map' ? styles.mobileTabActive : ''}`}
          onClick={() => setMobileTab('map')}
        >
          Map
        </button>
        <button
          className={`${styles.mobileTab} ${mobileTab === 'panel' ? styles.mobileTabActive : ''}`}
          onClick={() => setMobileTab('panel')}
        >
          Analysis
        </button>
      </div>

      <div className={styles.content}>
        <div className={`${styles.mapContainer} ${mobileTab !== 'map' ? styles.mobileHidden : ''}`}>
          <MapInterface
            selectedLayer={selectedLayer}
            onPolygonChange={handlePolygonChange}
          />
        </div>

        <div className={`${styles.panelContainer} ${mobileTab !== 'panel' ? styles.mobileHidden : ''}`}>
          <DashboardPanel
            hasPolygon={!!polygonData}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            result={analysisResult}
            analysisMode={analysisMode}
            onModeChange={setAnalysisMode}
          />
        </div>
      </div>

      {toastMsg && (
        <Toast message={toastMsg} variant="error" onDismiss={() => setToastMsg(null)} />
      )}
    </div>
  );
}
