import styles from './SearchPill.module.css';

interface SearchPillProps {
  onClick: () => void;       // opens SearchModal
  label?: string;            // default "搜索"
}

export default function SearchPill({ onClick, label = '搜索' }: SearchPillProps) {
  return (
    <button className={styles.root} onClick={onClick} aria-label="搜索">
      <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
