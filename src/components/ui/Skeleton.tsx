import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, radius = 3, className }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function SkeletonPanel() {
  return (
    <div className={styles.panel}>
      <Skeleton width="55%" height={11} />
      <Skeleton width="100%" height={56} radius={4} className={styles.mt8} />
      <div className={styles.row}>
        <Skeleton width="48%" height={44} radius={4} />
        <Skeleton width="48%" height={44} radius={4} />
      </div>
      <Skeleton width="40%" height={11} className={styles.mt16} />
      <Skeleton width="100%" height={80} radius={4} className={styles.mt8} />
      <Skeleton width="100%" height={80} radius={4} className={styles.mt8} />
      <Skeleton width="100%" height={80} radius={4} className={styles.mt8} />
    </div>
  );
}
