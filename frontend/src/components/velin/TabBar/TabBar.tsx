import { useNavigate, useLocation } from 'react-router-dom';
import type { JSX } from 'react';
import styles from './TabBar.module.css';

type TabKey = 'messages' | 'group' | 'create' | 'profile';

interface Tab {
  key: TabKey;
  label: string;
  path: string;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  { key: 'messages', label: '消息', path: '/',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.6 4.5 8.4 8.4 0 0 1-4-1L3 21l1.9-5.4a8.4 8.4 0 0 1-1-4 8.5 8.5 0 0 1 4.5-7.6 8.4 8.4 0 0 1 4-1h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg> },
  { key: 'group', label: '群聊', path: '/group',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M14 20a4.5 4.5 0 0 1 8 0"/></svg> },
  { key: 'create', label: '创作', path: '/character/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
  { key: 'profile', label: '我的', path: '/profile',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> },
];

export default function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string): boolean => {
    if (path === '/') return pathname === '/';
    if (path === '/group') return pathname.startsWith('/group');
    if (path === '/character/new') return pathname.startsWith('/character');
    if (path === '/profile') return pathname.startsWith('/profile');
    return false;
  };

  return (
    <nav className={styles.root} aria-label="主导航">
      {TABS.map(t => (
        <button
          key={t.key}
          className={[styles.tab, isActive(t.path) ? styles.active : ''].join(' ')}
          onClick={() => navigate(t.path)}
        >
          {t.icon}
          <span className={styles.lbl}>{t.label}</span>
        </button>
      ))}
      <div className={styles['home-indicator']} aria-hidden="true" />
    </nav>
  );
}
