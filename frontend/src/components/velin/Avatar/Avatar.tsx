import type { CSSProperties } from 'react';
import styles from './Avatar.module.css';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Theme = 'a' | 'b' | 'c' | 'd' | 'user';

interface AvatarProps {
  theme: Theme;
  label: string;            // 1–2 chars (Chinese first character or "我")
  size?: Size;
  showRing?: boolean;       // default true; false for inline use
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}

export default function Avatar({
  theme,
  label,
  size = 'md',
  showRing = true,
  style,
  onClick,
  ariaLabel,
}: AvatarProps) {
  const sizeClass = {
    sm: styles['size-sm'],
    md: styles['size-md'],
    lg: styles['size-lg'],
    xl: styles['size-xl'],
  }[size];
  const themeClass = styles[`theme-${theme}`];

  return (
    <div
      className={[styles.root, sizeClass, themeClass].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
    >
      {showRing && <span className={styles.ring} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
    </div>
  );
}
