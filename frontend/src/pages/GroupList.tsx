import { useEffect, useState } from 'react';
import { groupsApi } from '../api/client';
import type { Group } from '../api/types';
import AppShell from '../components/AppShell';
import Avatar from '../components/velin/Avatar';
import styles from './GroupList.module.css';

// Mirror the character theme scheme so the visual key matches.
const GROUP_THEMES = ['a', 'b', 'c', 'd'] as const;
type GroupTheme = typeof GROUP_THEMES[number];

function themeFor(id: string): GroupTheme {
  // Simple stable hash → theme
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return GROUP_THEMES[Math.abs(h) % GROUP_THEMES.length];
}

function memberCount(g: Group): number {
  if (g.members && g.members.length > 0) return g.members.length;
  // Some API responses only carry a count, fall back to 0 if unknown.
  return 0;
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '群';
  return trimmed.charAt(0);
}

export default function GroupList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await groupsApi.list();
        if (!cancelled) setGroups(res.data);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell blobTheme="c">
      <div className={styles.page}>
        <div className={styles.nav}>
          <div className={styles['title-row']}>
            <h1 className={styles.title}>群聊</h1>
            <div className={styles.actions}>
              <button
                className={styles['icon-btn']}
                aria-label="新建群聊"
                onClick={() => { window.location.hash = '#/group/new'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.sub}>
            <div className={styles.label}>
              {groups.length > 0
                ? `${groups.length} 个群聊`
                : '创建或加入群聊,与多个角色同场对话'}
            </div>
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.spinner} />
          ) : groups.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles['empty-text']}>还没有群聊,点 + 新建一个</div>
              <button
                className={styles.cta}
                onClick={() => { window.location.hash = '#/group/new'; }}
              >
                新建群聊
              </button>
            </div>
          ) : (
            groups.map(g => {
              const count = memberCount(g);
              const theme = themeFor(g.id);
              const firstMember = g.members?.[0]?.characters;
              return (
                <button
                  key={g.id}
                  className={[styles['group-card'], styles[`theme-${theme}`]].join(' ')}
                  onClick={() => { window.location.hash = `#/group/${g.id}`; }}
                  aria-label={`打开群聊 ${g.name}`}
                >
                  <Avatar
                    theme={theme}
                    label={initial(g.name)}
                    imageUrl={firstMember?.avatar}
                    size="lg"
                    style={{ width: 52, height: 52, fontSize: 17 }}
                  />
                  <div className={styles['card-meta']}>
                    <div className={styles['card-top']}>
                      <div className={styles['card-name']}>{g.name}</div>
                    </div>
                    <div className={styles['card-members']}>
                      {count > 0 ? `${count} 位角色` : '暂无成员'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
