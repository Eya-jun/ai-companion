import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { charactersApi, groupsApi } from '../api/client';
import type { Character } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import Avatar from '../components/velin/Avatar';
import { themeFor, type ThemeKey } from '../theme/characterThemes';
import styles from './GroupEdit.module.css';

export default function GroupEdit() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await charactersApi.list();
        setCharacters(res.data);
      } catch (e: any) {
        console.error('加载角色失败:', e);
      }
    })();
  }, []);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const submit = async () => {
    if (!name.trim()) {
      alert('群名必填');
      return;
    }
    if (selected.size < 2) {
      alert('至少选择2个角色');
      return;
    }
    setLoading(true);
    try {
      const res = await groupsApi.create({
        name: name.trim(),
        description: description.trim(),
        characterIds: Array.from(selected),
      });
      navigate(`/group/${res.data.id}`);
    } catch (e: any) {
      alert('创建失败:' + (e.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell showTabBar={false} blobTheme="c">
      <div className={styles.page}>
        <ChatHeader
          title="新建群聊"
          right={
            <button
              className={styles['header-btn']}
              onClick={submit}
              disabled={loading || !name.trim() || selected.size < 2}
              aria-label="创建"
            >
              {loading ? '创建中…' : '创建'}
            </button>
          }
        />

        <div className={styles.body}>
          <div className={styles['form-group']}>
            <label className={styles.label}>群名 *</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="给群聊起个名字"
            />
          </div>

          <div className={styles['form-group']}>
            <label className={styles.label}>描述</label>
            <input
              type="text"
              className={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="群聊简介（可选）"
            />
          </div>

          <div className={styles['form-group']}>
            <label className={styles.label}>
              选择成员 <span className={styles.dim}>(至少 2 个)</span>
            </label>
            <div className={styles.selector}>
              {characters.length === 0 ? (
                <div className={styles['empty-hint']}>还没有角色，先去创作页建一个</div>
              ) : (
                characters.map(c => {
                  const theme: ThemeKey = themeFor(c.name);
                  const isSel = selected.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={[styles['selector-item'], isSel ? styles.selected : ''].join(' ')}
                      onClick={() => toggleSelect(c.id)}
                      role="button"
                      aria-pressed={isSel}
                    >
                      <Avatar theme={theme} label={c.name.charAt(0)} size="md" />
                      <div className={styles['selector-meta']}>
                        <div className={styles['selector-name']}>{c.name}</div>
                        {c.description && (
                          <div className={styles['selector-desc']}>{c.description}</div>
                        )}
                      </div>
                      <div className={styles['selector-check']} aria-hidden="true">
                        {isSel ? '✓' : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
