"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './page.module.css';
import { useStore } from '../../store/useStore';
import { matchHouseModels } from '../../services/aiService';
import { fetchHouseModels } from '../../services/houseModelService';
import ParcelisPanel from '../../components/Parcelis/ParcelisPanel';
import type { AIAnalysisResult } from '../../models/types';

const ParcelisMap = dynamic(() => import('../../components/Parcelis/ParcelisMap'), { ssr: false });

export default function ParcelisPage() {
  const { selectedLand, setRecommendationList } = useStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!selectedLand) return;
    const addr = selectedLand.address?.trim() || '';
    if (addr) {
      window.open(`/property?address=${encodeURIComponent(addr)}`, '_blank');
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);
    try {
      const models = await fetchHouseModels();
      const { ranked, analysis } = await matchHouseModels(selectedLand, models);
      setAnalysisResult(analysis);
      setRecommendationList(ranked);
    } catch (e: unknown) {
      console.error("Analysis failed", e);
      setError(e instanceof Error ? e.message : "An unexpected error occurred during intelligence analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={14} /> Back to Hub
        </Link>
        <div className={styles.titleBlock}>
          <span className={styles.titleLabel}>PROPERTYVISION</span>
          <span className={styles.title}>Parcelis</span>
        </div>
        <div className={styles.modelSelector}>
          <select 
            value={useStore().aiModel} 
            onChange={(e) => useStore.getState().setAiModel(e.target.value)}
            className={styles.modelSelect}
          >
            <option value="claude-sonnet-4-6">Claude 4.6 Sonnet (Fast & Cost-Effective)</option>
            <option value="claude-opus-4-7">Claude 4.7 Opus (Deep Reasoning)</option>
            <option value="claude-haiku-4-5">Claude 4.5 Haiku (High Speed)</option>
          </select>
        </div>
        <div className={styles.statusDot} />
      </header>
      
      <div className={styles.content}>
        <div className={styles.mapContainer}>
          <ParcelisMap onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
        </div>
        <div className={styles.panelContainer}>
          <ParcelisPanel 
            isAnalyzing={isAnalyzing} 
            analysisResult={analysisResult} 
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
