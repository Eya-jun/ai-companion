import { useEffect, useState } from 'react';
import { charactersApi, extrasApi } from '../api/client';
import type { Character } from '../api/types';
import AppShell from '../components/AppShell';
import CharacterCard from '../components/velin/CharacterCard';
import SearchPill from '../components/velin/SearchPill';
import styles from './Home.module.css';

type Filter = 'all' | 'unread' | 'starred';

function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = now - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86400_000) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[new Date(iso).getDay()]}`;
  }
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [extrasCount, setExtrasCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  // TODO: SearchModal integration deferred to Task 8.1
  // const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await charactersApi.list();
        setCharacters(c.data);
        const counts: Record<string, number> = {};
        await Promise.all(c.data.map(async (ch: Character) => {
          try {
            const r = await extrasApi.list(ch.id);
            counts[ch.id] = r.data.length;
          } catch { counts[ch.id] = 0; }
        }));
        setExtrasCount(counts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // extrasCount currently only drives background fetches (preserved from old Home);
  // a future card variant may surface the badge count.
  void extrasCount;

  const total = characters.length;
  const unread = characters.filter(c => (c as any).unread_count > 0).length;

  return (
    <AppShell blobTheme="a">
      <div className={styles.page}>
        <div className={styles.nav}>
          <div className={styles['title-row']}>
            <h1 className={styles.title}>消息</h1>
            <div className={styles.actions}>
              {/* SearchPill click handler wired in Task 8.1 */}
              <SearchPill onClick={() => { /* opens SearchModal in Task 8.1 */ }} />
              <button
                className={styles['icon-btn']}
                aria-label="新建"
                onClick={() => { window.location.hash = '#/character/new'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.sub}>
            <div className={styles.label}>{total} 位角色 · {unread} 条未读</div>
            <div className={styles.seg} role="tablist">
              {(['all', 'unread', 'starred'] as Filter[]).map(f => (
                <button
                  key={f}
                  className={[styles['seg-btn'], filter === f ? styles.active : ''].join(' ')}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '全部' : f === 'unread' ? '未读' : '星标'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.spinner} />
          ) : characters.length === 0 ? (
            <div className={styles.empty}>还没有角色,点 + 新建一个</div>
          ) : (
            characters
              .filter(c => filter === 'unread' ? (c as any).unread_count > 0 : true)
              .map(c => (
                <CharacterCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  imageUrl={c.avatar}
                  tagline={undefined}
                  preview={(c as any).last_message || '开始一段对话'}
                  time={timeAgo((c as any).last_message_at)}
                  unread={(c as any).unread_count || 0}
                  online={!!(c as any).online}
                />
              ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
