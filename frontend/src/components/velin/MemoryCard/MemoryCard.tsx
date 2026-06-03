import { type ThemeKey } from '../../../theme/characterThemes';
import styles from './MemoryCard.module.css';

interface MemoryCardProps {
  date: string;
  text: string;
  tag?: string;
  theme?: ThemeKey;
}

export default function MemoryCard({ date, text, tag, theme = 'c' }: MemoryCardProps) {
  return (
    <div className={[styles.root, styles[`theme-${theme}`]].join(' ')}>
      <div className={styles.date}>{date}</div>
      <div className={styles.body}>
        <div className={styles.text}>{text}</div>
        {tag && <span className={styles.tag}>{tag}</span>}
      </div>
    </div>
  );
}
