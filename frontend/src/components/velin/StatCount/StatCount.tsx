import styles from './StatCount.module.css';

type Theme = 'a' | 'b' | 'c' | 'd';

interface StatCountProps {
  theme?: Theme;
  value: number;
  label: string;
  unit: string;
}

export default function StatCount({ theme = 'd', value, label, unit }: StatCountProps) {
  return (
    <div className={[styles.root, styles[`theme-${theme}`]].join(' ')}>
      <div className={styles.big}>{value}</div>
      <div className={styles.lbl}>{label}</div>
      <div className={styles.unit}>{unit}</div>
    </div>
  );
}
