import { type MouseEvent } from 'react';
import styles from './StatCount.module.css';

type Theme = 'a' | 'b' | 'c' | 'd';

interface StatCountProps {
  theme?: Theme;
  value: number;
  label: string;
  unit: string;
  onClick?: (e: MouseEvent) => void;
}

export default function StatCount({ theme = 'd', value, label, unit, onClick }: StatCountProps) {
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
      <div className={styles.big}>{value}</div>
      <div className={styles.lbl}>{label}</div>
      <div className={styles.unit}>{unit}</div>
    </div>
  );
}
