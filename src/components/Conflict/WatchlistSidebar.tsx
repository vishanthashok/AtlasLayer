'use client';

import { Star, StarOff, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useWatchlistStore } from '../../store/useWatchlistStore';
import { useConflictStore } from '../../store/useConflictStore';
import { scoreToColor } from './colors';
import styles from './WatchlistSidebar.module.css';

export function WatchlistSidebar() {
  const { watchedIsos, removeFromWatchlist, alerts, unreadCount, markAllRead } = useWatchlistStore();
  const { countries, selectCountry } = useConflictStore();

  const watched = countries.filter(c => watchedIsos.has(c.iso_a2));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>WATCHLIST</span>
        <span className={styles.headerCount}>{watchedIsos.size}</span>
      </div>

      {watched.length === 0 ? (
        <div className={styles.empty}>
          <Star size={20} />
          <span>No entities tracked</span>
          <span className={styles.emptySub}>Click ★ on any country to monitor</span>
        </div>
      ) : (
        <div className={styles.list}>
          {watched.map(c => {
            const color = scoreToColor(c.composite_score);
            const countryAlerts = alerts.filter(a => a.entityIso === c.iso_a2 && !a.read);
            return (
              <div key={c.iso_a2} className={styles.item} onClick={() => selectCountry(c)}>
                <div className={styles.itemTop}>
                  <img
                    src={`https://flagcdn.com/w20/${c.iso_a2.toLowerCase()}.png`}
                    alt="" width={16} height={11}
                    className={styles.flag}
                  />
                  <span className={styles.itemName}>{c.name}</span>
                  {countryAlerts.length > 0 && (
                    <span className={styles.alertDot}>{countryAlerts.length}</span>
                  )}
                  <button
                    className={styles.removeBtn}
                    onClick={e => { e.stopPropagation(); removeFromWatchlist(c.iso_a2); }}
                    title="Remove from watchlist"
                  >
                    <StarOff size={11} />
                  </button>
                </div>
                <div className={styles.itemBar}>
                  <div
                    className={styles.itemBarFill}
                    style={{ width: `${c.composite_score * 100}%`, background: color }}
                  />
                </div>
                <div className={styles.itemScore} style={{ color }}>
                  {(c.composite_score * 100).toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsHeader}>
            <AlertTriangle size={11} />
            <span>ALERTS</span>
            {unreadCount > 0 && (
              <button className={styles.markReadBtn} onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className={styles.alertsList}>
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className={`${styles.alertItem} ${a.read ? styles.alertRead : ''}`}>
                {a.newScore > a.prevScore
                  ? <TrendingUp size={11} style={{ color: '#ff3b3b', flexShrink: 0 }} />
                  : <TrendingDown size={11} style={{ color: '#22d3a5', flexShrink: 0 }} />
                }
                <div className={styles.alertText}>
                  <span className={styles.alertEntity}>{a.entityName}</span>
                  <span className={styles.alertMsg}>{a.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
