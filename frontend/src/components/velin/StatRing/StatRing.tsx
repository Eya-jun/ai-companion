import { type MouseEvent } from 'react';
import styles from './StatRing.module.css';

type Theme = 'a' | 'b' | 'c' | 'd';

interface StatRingProps {
  theme: Theme;
  value: number;          // 0–100
  max?: number;           // default 100
  label: string;
  size?: number;          // px, default 56
  onClick?: (e: MouseEvent) => void;
}

export default function StatRing({ theme, value, max = 100, label, size = 56, onClick }: StatRingProps) {
  const r = (size - 8) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - Math.min(value, max) / max);

  const interactive = !!onClick;

  return (
    <div
      className={[
        styles.root,
        styles[`theme-${theme}`],
        interactive ? styles.interactive : '',
      ].join(' ')}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className={styles.ring}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className={styles.track} cx={size / 2} cy={size / 2} r={r}
                  fill="none" strokeWidth="4" />
          <circle className={styles.bar} cx={size / 2} cy={size / 2} r={r}
                  fill="none" strokeWidth="4"
                  strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <div className={styles.val}>{value}</div>
      </div>
      <div className={styles.lbl}>{label}</div>
    </div>
  );
}
