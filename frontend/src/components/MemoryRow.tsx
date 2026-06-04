import { useState } from 'react';
import { memoriesApi } from '../api/client';
import styles from './MemoryRow.module.css';
import { type ThemeKey } from '../theme/characterThemes';

export interface Memory {
  id: string;
  character_id: string;
  memory_date: string;
  summary: string;
  affinity_delta: number | null;
  affinity_reason: string | null;
  source: 'ai' | 'user';
}

interface Props {
  memory: Memory;
  theme?: ThemeKey;
  onUpdated: () => void;
  onDeleted: () => void;
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const SaveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function MemoryRow({ memory, theme = 'c', onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.summary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      alert('内容不能为空');
      return;
    }
    setSaving(true);
    try {
      await memoriesApi.update(memory.id, { summary: text });
      onUpdated();
      setEditing(false);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除？')) return;
    try {
      await memoriesApi.delete(memory.id);
      onDeleted();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  const handleCancel = () => {
    setText(memory.summary);
    setEditing(false);
  };

  const isUser = memory.source === 'user';
  const affinity = memory.affinity_delta ?? 0;

  const rootClass = [styles.root, styles[`theme-${theme}`]].join(' ');

  if (editing) {
    return (
      <div className={rootClass}>
        <div className={styles.editor}>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            rows={4}
            autoFocus
            placeholder="写下要记住的事…"
          />
          <div className={styles.hint}>
            <span className={styles.hintAccent}>Ctrl+Enter</span> 保存 · <span className={styles.hintAccent}>Esc</span> 取消
            {saving && ' · 保存中…'}
          </div>
          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.btn}
              onClick={handleCancel}
              disabled={saving}
            >
              <CloseIcon />
              取消
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSave}
              disabled={saving || !text.trim()}
            >
              <SaveIcon />
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.date}>{memory.memory_date}</span>
          <span className={`${styles.sourceTag} ${!isUser ? styles.sourceTagAi : ''}`}>
            {isUser ? '手动' : 'AI'}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setEditing(true)}
            title="编辑"
            aria-label="编辑"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={handleDelete}
            title="删除"
            aria-label="删除"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <div className={styles.summary}>{memory.summary}</div>
      {memory.affinity_reason && (
        <div className={styles.affinity}>
          <span className={affinity >= 0 ? styles.affinityPos : styles.affinityNeg}>
            {affinity >= 0 ? '+' : ''}{memory.affinity_delta}
          </span>
          <span>· {memory.affinity_reason}</span>
        </div>
      )}
    </div>
  );
}
