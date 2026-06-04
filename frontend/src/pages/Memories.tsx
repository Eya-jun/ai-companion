import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { memoriesApi, charactersApi } from '../api/client';
import MemoryRow, { type Memory } from '../components/MemoryRow';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import styles from './Memories.module.css';

export default function Memories() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<{ name: string } | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');

  const load = async () => {
    if (!characterId) return;
    try {
      const [ch, mem] = await Promise.all([
        charactersApi.get(characterId),
        memoriesApi.list(characterId),
      ]);
      setCharacter(ch.data);
      setMemories(mem.data as Memory[]);
    } catch (e: any) {
      console.error('[Memories] load failed:', e);
    }
  };

  useEffect(() => { load(); }, [characterId]);

  // 按月分组(YYYY-MM 倒序)
  const grouped = useMemo(() => {
    const map = new Map<string, Memory[]>();
    memories.forEach(m => {
      const ym = (m.memory_date || '').substring(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [memories]);

  const handleAdd = async () => {
    if (!newText.trim() || !characterId) return;
    try {
      await memoriesApi.add(characterId, newDate, newText);
      setAdding(false);
      setNewText('');
      await load();
    } catch (e: any) {
      alert('新增失败: ' + e.message);
    }
  };

  if (!character) {
    return (
      <AppShell showTabBar={false} blobTheme="c">
        <div className={styles.loading}>加载中…</div>
      </AppShell>
    );
  }

  return (
    <AppShell showTabBar={false} blobTheme="c">
      <div className={styles.page}>
        <ChatHeader
          title="关键记忆"
          subtitle={character.name}
          showBack
          onBack={() => navigate(`/character/${characterId}`)}
          right={
            !adding ? (
              <button
                type="button"
                className={styles['top-add-btn']}
                onClick={() => setAdding(true)}
                aria-label="新增记忆"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>新增</span>
              </button>
            ) : false
          }
        />

        <div className={styles.meta}>
          <span>共 {memories.length} 条记忆</span>
          <span className={styles['meta-dot']} aria-hidden="true" />
          <span>按月倒序</span>
        </div>

        <div className={styles.body}>
          {adding && (
            <div className={styles['add-card']}>
              <div className={styles['add-head']}>
                <span className={styles['add-icon']}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span>新增记忆</span>
              </div>

              <div className={styles['add-row']}>
                <span className={styles['add-label']}>日期</span>
                <input
                  type="date"
                  className={styles['date-input']}
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
              </div>

              <textarea
                className={styles.textarea}
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={4}
                placeholder="写下你想记住的事…"
              />

              <div className={styles['add-actions']}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => { setAdding(false); setNewText(''); }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles['btn-primary']}`}
                  onClick={handleAdd}
                  disabled={!newText.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {grouped.length === 0 && !adding && (
            <div className={styles.empty}>
              <div className={styles['empty-icon']}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              还没有关键记忆
              <div className={styles['empty-hint']}>
                多聊聊就会有了。每天 2 点会自动评估昨天的对话
              </div>
            </div>
          )}

          {grouped.map(([ym, items]) => {
            const isCollapsed = !!collapsed[ym];
            return (
              <div key={ym} className={styles.group}>
                <div
                  className={styles['group-head']}
                  onClick={() => setCollapsed({ ...collapsed, [ym]: !isCollapsed })}
                  role="button"
                  aria-expanded={!isCollapsed}
                >
                  <div className={styles['group-title']}>
                    <span className={styles['group-icon']}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    </span>
                    <span>{ym}</span>
                  </div>
                  <div className={styles['group-count']}>
                    <span>{items.length} 条</span>
                    <svg
                      className={`${styles['group-chevron']} ${!isCollapsed ? styles.open : ''}`}
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className={styles['group-items']}>
                    {items.map(m => (
                      <MemoryRow key={m.id} memory={m} onUpdated={load} onDeleted={load} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
