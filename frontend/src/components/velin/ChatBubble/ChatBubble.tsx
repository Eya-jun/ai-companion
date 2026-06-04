import type { ReactNode } from 'react';
import styles from './ChatBubble.module.css';

type Sender = 'them' | 'me';
type Theme = 'a' | 'b' | 'c' | 'd';

interface ChatBubbleProps {
  sender: Sender;
  theme?: Theme;
  avatar?: ReactNode;
  stamp?: string;
  children: ReactNode;
}

export default function ChatBubble({ sender, theme = 'a', avatar, stamp, children }: ChatBubbleProps) {
  const rowClass = [styles.row, styles[sender], sender === 'me' ? styles[`theme-${theme}`] : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      {avatar}
      <div>
        <div className={styles.bubble}>{children}</div>
        {stamp && <div className={styles.stamp}>{stamp}</div>}
      </div>
    </div>
  );
}
