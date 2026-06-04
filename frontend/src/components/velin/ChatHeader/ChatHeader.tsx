import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  live?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  avatars?: ReactNode[];
}

export default function ChatHeader({
  title, subtitle, live, showBack = true, onBack, right, avatars,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={styles.root}>
      {showBack && (
        <button
          className={styles.btn}
          aria-label="返回"
          onClick={() => (onBack ? onBack() : navigate(-1))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {avatars && avatars.length > 0 && (
        <div className={styles['avatar-stack']}>
          {avatars.slice(0, 2)}
        </div>
      )}
      <div className={styles.info}>
        <div className={styles.name}>{title}</div>
        {subtitle && (
          <div className={styles.status}>
            {live && <span className={styles.dot} aria-hidden="true" />}
            <span>{subtitle}</span>
          </div>
        )}
      </div>
      {right ?? (
        <button className={styles.btn} aria-label="更多">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
          </svg>
        </button>
      )}
    </header>
  );
}
