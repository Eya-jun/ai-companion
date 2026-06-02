import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { charactersApi, groupsApi, extrasApi } from '../api/client';
import type { Character, Group } from '../api/types';
import AppHeader from '../components/AppHeader';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [extrasCount, setExtrasCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([
        charactersApi.list(),
        groupsApi.list(),
      ]);
      setCharacters(c.data);
      setGroups(g.data);

      // 加载每个角色的 extras 数量
      const counts: Record<string, number> = {};
      await Promise.all(
        c.data.map(async (char: Character) => {
          try {
            const res = await extrasApi.list(char.id);
            counts[char.id] = res.data.length;
          } catch {
            counts[char.id] = 0;
          }
        })
      );
      setExtrasCount(counts);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除「${name}」吗？`)) return;
    try {
      await charactersApi.delete(id);
      await load();
    } catch (e: any) {
      alert('删除失败：' + e.message);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`确定删除群聊「${name}」吗？`)) return;
    try {
      await groupsApi.delete(id);
      await load();
    } catch (e: any) {
      alert('删除失败：' + e.message);
    }
  };

  // 触发文件选择
  const triggerAvatarUpload = (id: string) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  // 处理头像上传（上传到 Supabase Storage）
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/avatars/upload/${uploadingId}`, {
        method: 'POST',
        body: formData,
        headers: import.meta.env.VITE_INTERNAL_TOKEN
          ? { 'X-Internal-Token': import.meta.env.VITE_INTERNAL_TOKEN }
          : {},
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '上传失败');
      }

      await res.json();
      await load();
      alert('头像已更新！');
    } catch (err: any) {
      alert('更新失败：' + err.message);
    }

    // 清空 input
    e.target.value = '';
    setUploadingId(null);
  };

  const isImage = (avatar: string) => {
    return avatar?.startsWith('data:image') || avatar?.startsWith('http');
  };

  return (
    <div className="home">
      <AppHeader />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      <header className="home-header">
        <h1>💕 AI 伴侣</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => navigate('/character/new')}>
            + 角色
          </button>
          <button className="btn-primary" onClick={() => navigate('/group/new')}>
            + 群聊
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={tab === 'private' ? 'tab active' : 'tab'}
          onClick={() => setTab('private')}
        >
          💬 私聊 ({characters.length})
        </button>
        <button
          className={tab === 'group' ? 'tab active' : 'tab'}
          onClick={() => setTab('group')}
        >
          👥 群聊 ({groups.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : tab === 'private' ? (
        <div className="character-grid">
          {characters.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💭</div>
              <div className="empty-title">还没有角色</div>
              <div className="empty-subtitle">点击右上角「+ 角色」开始创建</div>
              <button
                className="empty-action"
                onClick={() => navigate('/character/new')}
              >
                ✨ 立即创建
              </button>
            </div>
          ) : (
            characters.map(c => (
              <div key={c.id} className="character-card" onClick={() => navigate(`/chat/${c.id}`)}>
                <div className="avatar">
                  {isImage(c.avatar) ? (
                    <img src={c.avatar} alt={c.name} />
                  ) : (
                    <span style={{ fontSize: '32px' }}>{c.avatar}</span>
                  )}
                  <button
                    className="avatar-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerAvatarUpload(c.id);
                    }}
                    title="更换头像"
                  >
                    📷
                  </button>
                </div>
                <div className="info">
                  <div className="name">
                    {c.name}
                    {c.is_preset && <span className="badge">预设</span>}
                  </div>
                  <div className="desc">{c.description}</div>
                  {(extrasCount[c.id] ?? 0) > 0 && (
                    <div className="extras-badge" onClick={(e) => { e.stopPropagation(); navigate(`/character/${c.id}/extras`); }}>
                      📋 {extrasCount[c.id]} 条记录
                    </div>
                  )}
                </div>
                <div className="card-actions">
                  <button
                    className="btn-icon"
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/character/${c.id}/extras`);
                    }}
                    title="角色记录"
                  >
                    📋
                  </button>
                  {!c.is_preset && (
                    <>
                      <button
                        className="btn-icon"
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/character/${c.id}/edit`);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(c.id, c.name);
                        }}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="character-grid">
          {groups.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">👥</div>
              <div className="empty-title">还没有群聊</div>
              <div className="empty-subtitle">点击右上角「+ 群聊」开始创建</div>
              <button
                className="empty-action"
                onClick={() => navigate('/group/new')}
              >
                ✨ 立即创建
              </button>
            </div>
          ) : (
            groups.map(g => (
              <div key={g.id} className="character-card" onClick={() => navigate(`/group/${g.id}`)}>
                <div className="avatar">
                  <span style={{ fontSize: '32px' }}>👥</span>
                </div>
                <div className="info">
                  <div className="name">{g.name}</div>
                  <div className="desc">
                    {g.members?.length || 0} 个成员
                    {g.description ? ` · ${g.description}` : ''}
                  </div>
                </div>
                <div className="card-actions">
                  <button
                    className="btn-icon"
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteGroup(g.id, g.name);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
