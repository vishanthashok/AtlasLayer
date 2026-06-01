"use client";

import Link from 'next/link';
import { Home, Sprout, Globe2 } from 'lucide-react';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>AtlasLayer</div>
        <p className={styles.subtitle}>Unified intelligence for land — choose a product workspace</p>
      </header>
      
      <main className={styles.cardsContainer}>
        <Link href="/parcelis" className={`${styles.card} ${styles.cardParcelis}`}>
          <div className={styles.iconWrapper}>
            <Home size={48} className={styles.icon} />
          </div>
          <h2>Parcelis</h2>
          <p className={styles.cardMeta}>Real estate</p>
          <p>Analyze parcels and visualize recommended home models overlaid onto real-world plots.</p>
          <div className={styles.cardFooter}>Launch Parcelis →</div>
        </Link>
        
        <Link href="/fieldstone" className={`${styles.card} ${styles.cardFieldstone}`}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperFieldstone}`}>
            <Sprout size={48} className={styles.icon} />
          </div>
          <h2>Fieldstone</h2>
          <p className={styles.cardMeta}>Agriculture</p>
          <p>Satellite crop analysis and yield-oriented environmental insights for operational fields.</p>
          <div className={styles.cardFooter}>Launch Fieldstone →</div>
        </Link>

        <Link href="/conflict" className={`${styles.card} ${styles.cardConflict}`}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperConflict}`}>
            <Globe2 size={48} className={styles.icon} />
          </div>
          <h2>ConflictLens</h2>
          <p className={styles.cardMeta}>Geopolitics</p>
          <p>Real-time global risk heat map blending State Dept advisories, news NLP, and social signals.</p>
          <div className={styles.cardFooter}>Launch ConflictLens →</div>
        </Link>
      </main>
    </div>
  );
}
