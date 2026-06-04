import type { CSSProperties, MouseEvent } from 'react';
import styles from './Avatar.module.css';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Theme = 'a' | 'b' | 'c' | 'd' | 'user';

const isUrl = (s: string): boolean => /^https?:\/\//.test(s) || s.startsWith('data:');

interface AvatarProps {
  theme: Theme;
  label: string;            // 1–2 chars (Chinese first character or "我") — fallback when no imageUrl
  imageUrl?: string;        // if provided and looks like a URL, renders <img> instead of the label
  size?: Size;
  showRing?: boolean;       // default true; false for inline use
  style?: CSSProperties;
  onClick?: (e: MouseEvent) => void;
  ariaLabel?: string;
}

export default function Avatar({
  theme,
  label,
  imageUrl,
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
  const hasImage = !!(imageUrl && isUrl(imageUrl));

  return (
    <div
      className={[styles.root, sizeClass, themeClass].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
    >
      {showRing && <span className={styles.ring} aria-hidden="true" />}
      {hasImage ? (
        <img className={styles.img} src={imageUrl} alt={ariaLabel || label} />
      ) : (
        <span className={styles.label}>{label}</span>
      )}
    </div>
  );
}
