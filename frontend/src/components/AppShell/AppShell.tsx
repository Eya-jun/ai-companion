import type { ReactNode, CSSProperties } from 'react';
import TabBar from '../velin/TabBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  showTabBar?: boolean;
  showBlobs?: boolean;
  blobTheme?: 'a' | 'b' | 'c' | 'd' | 'user';
  style?: CSSProperties;
}

export default function AppShell({
  children, showTabBar = true, showBlobs = true, blobTheme = 'a', style,
}: AppShellProps) {
  return (
    <div className={styles.shell} style={style} data-theme={blobTheme}>
      {showBlobs && (
        <div className={styles.bg} aria-hidden="true">
          <div className={`${styles.blob} ${styles['blob-a']}`} />
          <div className={`${styles.blob} ${styles['blob-b']}`} />
        </div>
      )}
      <div className={styles.content}>
        {children}
      </div>
      {showTabBar && <TabBar />}
    </div>
  );
}
