import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Character } from '../../../api/types';
import Avatar from '../Avatar';
import { themeFor } from '../../../theme/characterThemes';
import styles from './SearchModal.module.css';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  characters: Character[];
}

const HOT_TAGS = ['治愈', '校园', '情感', '青梅竹马', '学长', '道士', '陪伴', '暗恋'];

export default function SearchModal({ open, onClose, characters }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [query, characters]);

  if (!open) return null;

  const onPick = (c: Character) => {
    onClose();
    navigate(`/character/${c.id}`);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="搜索角色或消息"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          />
          <button className={styles.cancel} onClick={onClose}>取消</button>
        </div>
        <div className={styles.body}>
          {query.trim() ? (
            <>
              <div className={styles['section-title']}>角色</div>
              {results.length === 0 ? (
                <div className={styles.empty}>没有匹配的角色</div>
              ) : (
                results.map(c => (
                  <div key={c.id} className={styles.row} onClick={() => onPick(c)}>
                    <Avatar theme={themeFor(c.name)} label={c.name.charAt(0)} size="md" />
                    <div>
                      <div className={styles['row-name']}>{c.name}</div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>{c.description}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className={styles['section-title']}>推荐角色</div>
              {characters.slice(0, 6).map(c => (
                <div key={c.id} className={styles.row} onClick={() => onPick(c)}>
                  <Avatar theme={themeFor(c.name)} label={c.name.charAt(0)} size="md" />
                  <div className={styles['row-name']}>{c.name}</div>
                </div>
              ))}
              <div className={styles['section-title']}>热门标签</div>
              <div className={styles['tag-row']}>
                {HOT_TAGS.map(t => (
                  <button key={t} className={styles.tag} onClick={() => setQuery(t)}>{t}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
