import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { charactersApi, extrasApi, affinityApi } from '../api/client';
import type { AffinityState, Character } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import ExtraRow, { type Extra } from '../components/ExtraRow';
import styles from './CharacterExtras.module.css';

type ExtraType = 'note' | 'story' | 'relationship' | 'memory_hint';

const TABS: Array<{ type: ExtraType; label: string; desc: string }> = [
  { type: 'note', label: '补充设定', desc: '语气、习惯、个性化设定' },
  { type: 'story', label: '故事背景', desc: '你们之间发生过的故事' },
  { type: 'relationship', label: '关系记录', desc: '关系进展、关键时刻' },
  { type: 'memory_hint', label: '记忆提示', desc: '提醒 AI 注意的事' },
];

const STAGE_LABEL: Record<AffinityState['stage'], string> = {
  stranger: '陌生',
  familiar: '熟悉',
  flirtatious: '暧昧',
  intimate: '亲密',
};

export default function CharacterExtras() {
  const { characterId } = useParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [activeTab, setActiveTab] = useState<ExtraType>('note');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const [affinity, setAffinity] = useState<AffinityState | null>(null);
  const [affinityBusy, setAffinityBusy] = useState(false);

  const load = async () => {
    if (!characterId) return;
    try {
      const [ch, ext, aff] = await Promise.all([
        charactersApi.get(characterId),
        extrasApi.list(characterId),
        affinityApi.get(characterId).catch(() => ({ data: null })),
      ]);
      setCharacter(ch.data);
      setExtras(ext.data as Extra[]);
      if (aff.data) setAffinity(aff.data);
    } catch (e: any) {
      alert('加载失败: ' + e.message);
    }
  };

  useEffect(() => { load(); }, [characterId]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !characterId) {
      alert('标题和内容必填');
      return;
    }
    try {
      if (editing) {
        await extrasApi.update(editing.id, form);
      } else {
        await extrasApi.create({ character_id: characterId, type: activeTab, ...form });
      }
      setShowModal(false);
      setEditing(null);
      setForm({ title: '', content: '' });
      await load();
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }
  };

  const handleAffinitySet = async (v: number) => {
    if (!characterId || affinityBusy) return;
    setAffinityBusy(true);
    try {
      const r = await affinityApi.set(characterId, v);
      setAffinity(s => s
        ? { ...s, affinity: r.data.affinity, stage: r.data.stage as AffinityState['stage'], unlockedAt: r.data.unlockedAt }
        : s
      );
      if (v >= 100) localStorage.removeItem(`seen_celebration_for_${characterId}`);
    } catch (e: any) {
      alert('设置失败: ' + e.message);
    } finally {
      setAffinityBusy(false);
    }
  };

  if (!character) {
    return (
      <AppShell showTabBar={false}>
        <div className={styles.loading}>加载中…</div>
      </AppShell>
    );
  }

  const filtered = extras.filter(e => e.type === activeTab);
  const activeInfo = TABS.find(t => t.type === activeTab)!;
  const showFab = activeTab !== 'relationship';

  return (
    <AppShell showTabBar={false} blobTheme="a">
      <div className={styles.page}>
        <ChatHeader title={`${character.name} · 补充资料`} showBack />

        <div className={styles.tabs} role="tablist">
          {TABS.map(tab => {
            const count = extras.filter(e => e.type === tab.type).length;
            const isActive = activeTab === tab.type;
            return (
              <button
                key={tab.type}
                role="tab"
                aria-selected={isActive}
                className={`${styles.tab} ${isActive ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.type)}
              >
                <span>{tab.label}</span>
                <span className={styles['tab-count']}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className={styles.body}>
          <p className={styles.desc}>{activeInfo.desc}</p>

          {activeTab === 'relationship' && (
            <AffinityControlPanel
              affinity={affinity}
              busy={affinityBusy}
              onSet={handleAffinitySet}
            />
          )}

          {activeTab === 'relationship' && filtered.length > 0 && <div className={styles.divider} />}

          {activeTab !== 'relationship' && filtered.length === 0 ? (
            <div className={styles.empty}>
              还没有{activeInfo.label}
              <br />
              点右下角 + 开始添加
            </div>
          ) : activeTab === 'relationship' && filtered.length === 0 ? (
            <div className={styles.empty}>
              还没有{activeInfo.label}
              <br />
              点右上角 + 开始添加
            </div>
          ) : (
            <div className={styles.list}>
              {filtered.map(e => (
                <ExtraRow key={e.id} extra={e} onUpdated={load} onDeleted={load} />
              ))}
            </div>
          )}
        </div>

        {showFab && (
          <button
            className={styles.fab}
            onClick={() => { setEditing(null); setForm({ title: '', content: '' }); setShowModal(true); }}
            aria-label="新增"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>新增</span>
          </button>
        )}

        {showModal && (
          <div className={styles.overlay} onClick={() => setShowModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h3 className={styles['modal-title']}>
                {editing ? '编辑' : '新增'}{activeInfo.label}
              </h3>
              <div>
                <label className={styles.desc} style={{ display: 'block', marginBottom: 6 }}>
                  标题 *
                </label>
                <input
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'var(--glass-1)', border: '1px solid var(--hair)',
                    borderRadius: 'var(--r-md)', color: 'var(--text)',
                    fontSize: 'var(--t-body)', outline: 'none', boxSizing: 'border-box',
                  }}
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="简短标题"
                />
              </div>
              <div>
                <label className={styles.desc} style={{ display: 'block', marginBottom: 6 }}>
                  内容 *
                </label>
                <textarea
                  style={{
                    width: '100%', padding: '10px 14px', minHeight: 140,
                    background: 'var(--glass-1)', border: '1px solid var(--hair)',
                    borderRadius: 'var(--r-md)', color: 'var(--text)',
                    fontSize: 'var(--t-body)', lineHeight: 1.6,
                    fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  placeholder="详细内容..."
                />
              </div>
              <div className={styles['modal-actions']}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles['btn-secondary']}`}
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles['btn-primary']}`}
                  onClick={handleSave}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* 关系 tab 顶部的亲密度调整面板 */
function AffinityControlPanel({
  affinity, busy, onSet,
}: {
  affinity: AffinityState | null;
  busy: boolean;
  onSet: (v: number) => void;
}) {
  const current = affinity?.affinity ?? 0;
  const stage = affinity?.stage ?? 'stranger';

  return (
    <div className={styles.affinity}>
      <div className={styles['affinity-head']}>
        <span className={styles['affinity-title']}>当前亲密度</span>
        <span className={styles['affinity-stage']}>阶段：{STAGE_LABEL[stage]}</span>
      </div>
      <div className={styles['affinity-value']}>{current}%</div>
      <div className={styles['affinity-bar']}>
        <div className={styles['affinity-bar-fill']} style={{ width: `${current}%` }} />
      </div>
      <div className={styles['affinity-meta']}>
        {current < 100
          ? `再 ${100 - current}% 解锁亲密模式`
          : '已达到 100%，亲密模式已解锁'}
      </div>
      <div className={styles['affinity-actions']}>
        {[0, 25, 50, 80, 100].map(v => (
          <button
            key={v}
            className={`${styles['affinity-pill']} ${current === v ? styles.active : ''}`}
            onClick={() => onSet(v)}
            disabled={busy}
          >
            {v}
          </button>
        ))}
      </div>
      <p className={styles['affinity-hint']}>
        默认由每日 2 点的 cron 评估增长；手动调只是临时调整，会被覆盖。
      </p>
    </div>
  );
}
