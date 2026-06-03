import styles from './Wordmark.module.css';

interface WordmarkProps {
  size?: 'sm' | 'md';
}

export default function Wordmark({ size = 'md' }: WordmarkProps) {
  return (
    <span className={styles.root} aria-label="Vélin · 尺素">
      <span className={styles.fr} style={size === 'sm' ? { fontSize: 15 } : undefined}>Vélin</span>
      <span className={styles.dot}>·</span>
      <span className={styles.cn} style={size === 'sm' ? { fontSize: 13 } : undefined}>尺素</span>
    </span>
  );
}
