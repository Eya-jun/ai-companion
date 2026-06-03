import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, affinityApi, memoriesApi } from '../api/client';
import type { Character, AffinityState, AffinityStage } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import Avatar from '../components/velin/Avatar';
import StatRing from '../components/velin/StatRing';
import StatCount from '../components/velin/StatCount';
import MemoryCard from '../components/velin/MemoryCard';
import { themeFor, type ThemeKey } from '../theme/characterThemes';
import styles from './CharacterDetail.module.css';

const stageToIntimacy = (stage?: AffinityStage): number => {
  switch (stage) {
    case 'stranger':   return 15;
    case 'familiar':   return 40;
    case 'flirtatious':return 70;
    case 'intimate':   return 95;
    default:           return 0;
  }
};

export default function CharacterDetail() {
  const { characterId = '' } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [affinity, setAffinity] = useState<AffinityState | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [recentMemories, setRecentMemories] = useState<Array<{ date: string; text: string; tag?: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await charactersApi.get(characterId);
        setCharacter(c.data);
        try {
          const a = await affinityApi.get(characterId);
          setAffinity(a.data);
        } catch { /* no affinity yet */ }
        try {
          const m = await memoriesApi.list(characterId);
          setMemoryCount(m.data.length);
          setRecentMemories(m.data.slice(0, 3).map((mem: any) => ({
            date: new Date(mem.created_at).toLocaleDateString('zh-CN'),
            text: mem.summary || mem.content,
            tag: mem.tag,
          })));
        } catch { /* no memories yet */ }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [characterId]);

  if (!character) {
    return (
      <AppShell showTabBar={false}>
        <div className={styles.page} />
      </AppShell>
    );
  }

  const theme: ThemeKey = themeFor(character.name);

  return (
    <AppShell showTabBar={false} blobTheme={theme}>
      <div className={styles.page}>
        <ChatHeader title={character.name} subtitle="在线 · 刚刚" live showBack />

        <div className={styles.hero} data-theme={theme}>
          <div className={styles['hero-content']}>
            <Avatar theme={theme} label={character.name.charAt(0)} size="xl" />
            <div className={styles['hero-name']}>{character.name}</div>
            <div className={styles['hero-tag']}>{character.description || '角色'}</div>
          </div>
        </div>

        <div className={styles.body}>
          {character.description && (
            <div className={styles.desc}>{character.description}</div>
          )}

          <div className={styles['stats-row']}>
            <StatRing theme="a" value={Math.round(affinity?.affinity || 0)} label="好感度" />
            <StatRing theme="b" value={stageToIntimacy(affinity?.stage)} label="亲密度" />
            <StatCount theme="d" value={memoryCount} label="珍藏" unit="个故事" />
          </div>

          <div>
            <div className={styles['section-title']}>
              <h3>关键记忆</h3>
              <span className={styles.more} onClick={() => navigate(`/character/${characterId}/memories`)}>
                查看全部 →
              </span>
            </div>
            <div className={styles.memories}>
              {recentMemories.length === 0 ? (
                <div className={styles['memories-empty']}>
                  还没有关键记忆，多聊聊就会有了
                </div>
              ) : (
                recentMemories.map((m, i) => (
                  <MemoryCard key={i} date={m.date} text={m.text} tag={m.tag} theme={theme} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => navigate(`/character/${characterId}/edit`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>编辑</span>
          </button>
          <button className={`${styles.btn} ${styles['btn-primary']}`} onClick={() => navigate(`/chat/${characterId}`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.6 4.5 8.4 8.4 0 0 1-4-1L3 21l1.9-5.4a8.4 8.4 0 0 1-1-4 8.5 8.5 0 0 1 4.5-7.6 8.4 8.4 0 0 1 4-1h.5a8.5 8.5 0 0 1 8 8v.5z"/>
            </svg>
            <span>开始聊天</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
