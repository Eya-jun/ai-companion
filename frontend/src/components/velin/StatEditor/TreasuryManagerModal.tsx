import { useEffect, useState } from 'react';
import { memoriesApi } from '../../../api/client';
import styles from './TreasuryManager.module.css';

interface TreasuryManagerModalProps {
  open: boolean;
  characterId: string;
  onClose: () => void;
  onChanged: () => void;  // 列表/计数变化后,通知父级刷新
}

type Mode = 'list' | 'ai' | 'manual';

const today = () => new Date().toISOString().split('T')[0];

/**
 * 珍藏管理弹窗。展示该角色所有记忆,支持:
 *  - 切换珍藏 (star)
 *  - 删除
 *  - AI 总结某天
 *  - 手动新增
 */
export default function TreasuryManagerModal({ open, characterId, onClose, onChanged }: TreasuryManagerModalProps) {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('list');
  const [aiDate, setAiDate] = useState<string>(today());
  const [manDate, setManDate] = useState<string>(today());
  const [manText, setManText] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await memoriesApi.list(characterId);
      setMemories(res.data || []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMode('list');
      setManText('');
      setAiDate(today());
      setManDate(today());
      refresh();
    }
  }, [open, characterId]);

  if (!open) return null;

  const onToggleStar = async (mem: any) => {
    if (busyId) return;
    setBusyId(mem.id);
    setErr(null);
    try {
      await memoriesApi.toggleStar(mem.id, !mem.is_starred);
      // 本地乐观更新
      setMemories(prev => prev.map(m =>
        m.id === mem.id
          ? { ...m, is_starred: !mem.is_starred, starred_at: !mem.is_starred ? new Date().toISOString() : null }
          : m
      ));
      onChanged();
    } catch (e: any) {
      setErr(e?.message || '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (mem: any) => {
    if (!confirm('确认删除这条记忆?')) return;
    if (busyId) return;
    setBusyId(mem.id);
    setErr(null);
    try {
      await memoriesApi.delete(mem.id);
      setMemories(prev => prev.filter(m => m.id !== mem.id));
      onChanged();
    } catch (e: any) {
      setErr(e?.message || '删除失败');
    } finally {
      setBusyId(null);
    }
  };

  const onAiSummarize = async () => {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      await memoriesApi.summarize(characterId, aiDate);
      await refresh();
      onChanged();
      setMode('list');
    } catch (e: any) {
      setErr(e?.message || '总结失败');
    } finally {
      setSaving(false);
    }
  };

  const onManualAdd = async () => {
    if (saving) return;
    if (!manText.trim()) {
      setErr('请输入记忆内容');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await memoriesApi.add(characterId, manDate, manText.trim());
      setManText('');
      await refresh();
      onChanged();
      setMode('list');
    } catch (e: any) {
      setErr(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => setMode('list')} disabled={mode === 'list'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h3 className={styles.title}>
            {mode === 'list' && '珍藏管理'}
            {mode === 'ai' && 'AI 总结'}
            {mode === 'manual' && '手动新增记忆'}
          </h3>
          <button className={styles.close} onClick={onClose}>完成</button>
        </div>

        {err && <div className={styles.error}>{err}</div>}

        <div className={styles.body}>
          {mode === 'list' && (
            <>
              <div className={styles['action-row']}>
                <button className={styles['action-btn']} onClick={() => setMode('ai')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L9.5 8.5 2 12l7.5 3.5L12 22l2.5-6.5L22 12l-7.5-3.5z"/>
                  </svg>
                  <span>AI 总结</span>
                </button>
                <button className={styles['action-btn']} onClick={() => setMode('manual')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>手动添加</span>
                </button>
              </div>

              {loading ? (
                <div className={styles.empty}>加载中…</div>
              ) : memories.length === 0 ? (
                <div className={styles.empty}>
                  还没有任何记忆。<br />试试 AI 总结,或手动添加。
                </div>
              ) : (
                <div className={styles.list}>
                  {memories.map(m => (
                    <div
                      key={m.id}
                      className={[styles.item, m.is_starred ? styles.starred : ''].join(' ')}
                    >
                      <div className={styles['item-main']}>
                        <div className={styles.date}>{m.memory_date}</div>
                        <div className={styles.text}>
                          {m.summary || '(空)'}
                        </div>
                      </div>
                      <div className={styles['item-actions']}>
                        <button
                          className={styles.icon}
                          onClick={() => onToggleStar(m)}
                          disabled={busyId === m.id}
                          aria-label={m.is_starred ? '取消珍藏' : '珍藏'}
                          title={m.is_starred ? '取消珍藏' : '珍藏'}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill={m.is_starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </button>
                        <button
                          className={styles.icon}
                          onClick={() => onDelete(m)}
                          disabled={busyId === m.id}
                          aria-label="删除"
                          title="删除"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'ai' && (
            <div className={styles['form']}>
              <label className={styles.label}>选择要总结的日期</label>
              <input
                className={styles.input}
                type="date"
                value={aiDate}
                onChange={e => setAiDate(e.target.value)}
                max={today()}
              />
              <div className={styles.hint}>
                AI 会读取当天和此角色的所有聊天记录,生成第一人称的记忆总结。
              </div>
              <button
                className={styles['submit']}
                onClick={onAiSummarize}
                disabled={saving}
              >
                {saving ? '生成中…' : '生成总结'}
              </button>
            </div>
          )}

          {mode === 'manual' && (
            <div className={styles['form']}>
              <label className={styles.label}>日期</label>
              <input
                className={styles.input}
                type="date"
                value={manDate}
                onChange={e => setManDate(e.target.value)}
                max={today()}
              />
              <label className={styles.label}>记忆内容</label>
              <textarea
                className={styles.textarea}
                value={manText}
                onChange={e => setManText(e.target.value)}
                placeholder="写下想记住的瞬间…"
                rows={6}
              />
              <button
                className={styles['submit']}
                onClick={onManualAdd}
                disabled={saving || !manText.trim()}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
