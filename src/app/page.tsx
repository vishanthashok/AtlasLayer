"use client";

import Link from 'next/link';
import { Home, Sprout, Globe2, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

const PRODUCTS = [
  {
    href: '/parcelis',
    cardClass: 'cardParcelis',
    wrapClass: '',
    accent: 'var(--product-parcelis-accent)',
    icon: <Home size={28} />,
    tag: 'Real Estate',
    name: 'Parcelis',
    desc: 'AI-driven parcel intelligence — property data, hazard profiles, market analytics, and home model overlays.',
    features: ['Census · OSM · USGS · FEMA', 'CAD registry lookup', 'Model feasibility scoring'],
  },
  {
    href: '/fieldstone',
    cardClass: 'cardFieldstone',
    wrapClass: 'iconWrapperFieldstone',
    accent: 'var(--product-fieldstone-accent)',
    icon: <Sprout size={28} />,
    tag: 'Agriculture',
    name: 'Fieldstone',
    desc: 'Satellite-backed crop intelligence — NASA climate normals, SoilGrids analysis, and scenario simulation.',
    features: ['NASA POWER · SoilGrids · Open-Meteo', 'What-if scenario modeler', 'Portfolio tracking'],
  },
  {
    href: '/conflict',
    cardClass: 'cardConflict',
    wrapClass: 'iconWrapperConflict',
    accent: 'var(--product-conflictlens-accent)',
    icon: <Globe2 size={28} />,
    tag: 'Geopolitics',
    name: 'ConflictLens',
    desc: 'Real-time global risk scoring — State Dept advisories, NLP news signals, and social data on a live heat map.',
    features: ['State Dept advisory scraper', 'NLP conflict scoring', 'Live SSE updates'],
  },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <div className={styles.logoMark} aria-hidden />
          <span className={styles.logo}>AtlasLayer</span>
        </div>
        <p className={styles.subtitle}>Unified land intelligence platform</p>
        <p className={styles.subtitleSub}>Choose a workspace to begin</p>
      </header>

      <main className={styles.cardsContainer}>
        {PRODUCTS.map((p) => (
          <Link key={p.href} href={p.href} className={`${styles.card} ${styles[p.cardClass as keyof typeof styles]}`}>
            <div className={styles.cardTop}>
              <div className={`${styles.iconWrapper} ${p.wrapClass ? styles[p.wrapClass as keyof typeof styles] : ''}`}>
                {p.icon}
              </div>
              <span className={styles.cardTag}>{p.tag}</span>
            </div>

            <h2 className={styles.cardName}>{p.name}</h2>
            <p className={styles.cardDesc}>{p.desc}</p>

            <ul className={styles.cardFeatures}>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <div className={styles.cardFooter}>
              <span>Launch {p.name}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </main>

      <footer className={styles.footer}>
        <span>AtlasLayer</span>
        <span className={styles.footerDot} />
        <span>Land Intelligence Platform</span>
      </footer>
    </div>
  );
}
