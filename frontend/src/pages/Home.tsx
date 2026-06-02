import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { charactersApi, groupsApi, extrasApi, affinityApi, API_BASE, getStoredSession } from '../api/client';
import type { Character, Group, AffinityState } from '../api/types';
import AppHeader from '../components/AppHeader';
import AffinityMeter from '../components/AffinityMeter';
import './Home.css';

type Tab = 'home' | 'private' | 'group' | 'profile';

export default function Home() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [extrasCount, setExtrasCount] = useState<Record<string, number>>({});
  const [affinities, setAffinities] = useState<Record<string, AffinityState>>({});
  const [loading, setLoading] = useState(true);
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

      const aff: Record<string, AffinityState> = {};
      await Promise.all(
        c.data.map(async (char: Character) => {
          try {
            const r = await affinityApi.get(char.id);
            aff[char.id] = r.data;
          } catch {
            aff[char.id] = { affinity: 0, stage: 'stranger', mode: 'daily', unlockedAt: null, latestReason: null, latestDelta: null, difficulty: 'normal' };
          }
        })
      );
      setAffinities(aff);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除「${name}」吗？`)) return;
    try { await charactersApi.delete(id); await load(); } catch (e: any) { alert('删除失败：' + e.message); }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`确定删除群聊「${name}」吗？`)) return;
    try { await groupsApi.delete(id); await load(); } catch (e: any) { alert('删除失败：' + e.message); }
  };

  const triggerAvatarUpload = (id: string) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    if (file.size > 2 * 1024 * 1024) { alert('图片大小不能超过 2MB'); return; }
    try {
      const formData = new FormData();
      formData.append('file', file);
      // 头像上传必须带 Authorization 头(后端 requireAuth),否则返回 401
      const headers: Record<string, string> = {};
      const session = getStoredSession();
      if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;
      if (import.meta.env.VITE_INTERNAL_TOKEN) headers['X-Internal-Token'] = import.meta.env.VITE_INTERNAL_TOKEN;
      const res = await fetch(`${API_BASE}/avatars/upload/${uploadingId}`, { method: 'POST', body: formData, headers });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || '上传失败'); }
      await res.json();
      await load();
    } catch (err: any) {
      alert('更新失败：' + err.message);
    }
    e.target.value = '';
    setUploadingId(null);
  };

  const isImage = (avatar: string) => avatar?.startsWith('data:image') || avatar?.startsWith('http');

  const handleTabChange = (t: Tab) => {
    if (t === 'profile') navigate('/profile');
    else setActiveTab(t);
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

      {/* 极简顶部 */}
      <div className="home-top">
        <h1>AI 伴侣</h1>
      </div>

      {/* 主内容区 */}
      <div className="home-body">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : activeTab === 'home' ? (
          <HomeView
            characters={characters}
            groups={groups}
            affinities={affinities}
            extrasCount={extrasCount}
            isImage={isImage}
            onCardClick={(id: string) => navigate(`/chat/${id}`)}
            onGroupClick={(id: string) => navigate(`/group/${id}`)}
            onExtrasClick={(id: string) => navigate(`/character/${id}/extras`)}
            onEditClick={(id: string) => navigate(`/character/${id}/edit`)}
            onDelete={handleDelete}
            onDeleteGroup={handleDeleteGroup}
            onAvatarClick={triggerAvatarUpload}
            onCreateCharacter={() => navigate('/character/new')}
            onCreateGroup={() => navigate('/group/new')}
          />
        ) : activeTab === 'private' ? (
          <PrivateView
            characters={characters}
            affinities={affinities}
            extrasCount={extrasCount}
            isImage={isImage}
            onCardClick={(id: string) => navigate(`/chat/${id}`)}
            onExtrasClick={(id: string) => navigate(`/character/${id}/extras`)}
            onEditClick={(id: string) => navigate(`/character/${id}/edit`)}
            onDelete={handleDelete}
            onAvatarClick={triggerAvatarUpload}
            onCreate={() => navigate('/character/new')}
          />
        ) : (
          <GroupView
            groups={groups}
            onCardClick={(id: string) => navigate(`/group/${id}`)}
            onDelete={handleDeleteGroup}
            onCreate={() => navigate('/group/new')}
          />
        )}
      </div>

      {/* FAB:在 群聊 tab 上 FAB 创建群,其他 tab 创建角色 */}
      {activeTab !== 'profile' && (
        <button
          className="fab"
          onClick={() => navigate(activeTab === 'group' ? '/group/new' : '/character/new')}
          title={activeTab === 'group' ? '新建群聊' : '新建角色'}
        >
          <PlusIcon />
        </button>
      )}

      {/* 底部 Tab Bar */}
      <nav className="tab-bar">
        <button className={`tab-bar-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleTabChange('home')}>
          <HomeIcon />
          <span>主页</span>
        </button>
        <button className={`tab-bar-item ${activeTab === 'private' ? 'active' : ''}`} onClick={() => handleTabChange('private')}>
          <ChatIcon />
          <span>聊天</span>
        </button>
        <button className={`tab-bar-item ${activeTab === 'group' ? 'active' : ''}`} onClick={() => handleTabChange('group')}>
          <GroupIcon />
          <span>群聊</span>
        </button>
        <button className={`tab-bar-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleTabChange('profile')}>
          <ProfileIcon />
          <span>我的</span>
        </button>
      </nav>
    </div>
  );
}

/* ============== Views ============== */

function HomeView({
  characters, groups, affinities, extrasCount, isImage,
  onCardClick, onGroupClick, onExtrasClick, onEditClick, onDelete, onDeleteGroup, onAvatarClick,
  onCreateCharacter, onCreateGroup,
}: any) {
  return (
    <>
      <Section title="聊天" count={characters.length}>
        {characters.length === 0 ? (
          <EmptyState
            title="还没有角色"
            subtitle="点击右下角 + 创建你的第一个 AI 伴侣"
            actionLabel="立即创建"
            onAction={onCreateCharacter}
          />
        ) : (
          characters.map((c: Character) => (
            <CharacterCard
              key={c.id} char={c}
              affinity={affinities[c.id]}
              extrasCount={extrasCount[c.id] ?? 0}
              isImage={isImage}
              onClick={() => onCardClick(c.id)}
              onExtrasClick={() => onExtrasClick(c.id)}
              onEditClick={() => onEditClick(c.id)}
              onDelete={() => onDelete(c.id, c.name)}
              onAvatarClick={() => onAvatarClick(c.id)}
            />
          ))
        )}
      </Section>

      <Section title="群聊" count={groups.length}>
        {groups.length === 0 ? (
          <EmptyState
            title="还没有群聊"
            subtitle="把多个角色拉进一个群,让他们自己聊天"
            actionLabel="新建群聊"
            onAction={onCreateGroup}
          />
        ) : (
          groups.map((g: Group) => (
            <GroupCard
              key={g.id} group={g}
              onClick={() => onGroupClick(g.id)}
              onDelete={() => onDeleteGroup(g.id, g.name)}
            />
          ))
        )}
      </Section>
    </>
  );
}

function PrivateView({
  characters, affinities, extrasCount, isImage,
  onCardClick, onExtrasClick, onEditClick, onDelete, onAvatarClick, onCreate,
}: any) {
  if (characters.length === 0) {
    return (
      <EmptyState
        title="还没有角色"
        subtitle="点击右下角 + 创建你的第一个 AI 伴侣"
        actionLabel="立即创建"
        onAction={onCreate}
      />
    );
  }
  return (
    <Section title="聊天" count={characters.length}>
      {characters.map((c: Character) => (
        <CharacterCard
          key={c.id} char={c}
          affinity={affinities[c.id]}
          extrasCount={extrasCount[c.id] ?? 0}
          isImage={isImage}
          onClick={() => onCardClick(c.id)}
          onExtrasClick={() => onExtrasClick(c.id)}
          onEditClick={() => onEditClick(c.id)}
          onDelete={() => onDelete(c.id, c.name)}
          onAvatarClick={() => onAvatarClick(c.id)}
        />
      ))}
    </Section>
  );
}

function GroupView({ groups, onCardClick, onDelete, onCreate }: any) {
  if (groups.length === 0) {
    return (
      <EmptyState
        title="还没有群聊"
        subtitle="把多个角色拉进一个群,让他们自己聊天"
        actionLabel="新建群聊"
        onAction={onCreate}
      />
    );
  }
  return (
    <Section title="群聊" count={groups.length}>
      {groups.map((g: Group) => (
        <GroupCard
          key={g.id} group={g}
          onClick={() => onCardClick(g.id)}
          onDelete={() => onDelete(g.id, g.name)}
        />
      ))}
    </Section>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="list-section">
      <div className="list-section-title">
        <span>{title}</span>
        <span className="count">{count}</span>
      </div>
      {children}
    </section>
  );
}

function CharacterCard({
  char, affinity, extrasCount, isImage, onClick, onExtrasClick, onEditClick, onDelete, onAvatarClick,
}: any) {
  return (
    <div className="list-card" onClick={onClick}>
      <div className="avatar" onClick={(e) => { e.stopPropagation(); onAvatarClick(); }} title="点击更换头像" style={{ cursor: 'pointer' }}>
        {isImage(char.avatar) ? (
          <img src={char.avatar} alt={char.name} />
        ) : (
          <span className="avatar-text">{char.avatar}</span>
        )}
      </div>
      <div className="info">
        <div className="name">
          {char.name}
          {char.is_preset && <span className="badge">预设</span>}
        </div>
        <div className="desc">{char.description}</div>
        {affinity && (
          <AffinityMeter affinity={affinity.affinity} stage={affinity.stage} variant="card" />
        )}
        {extrasCount > 0 && (
          <div className="extras-badge" onClick={(e) => { e.stopPropagation(); onExtrasClick(); }}>
            {extrasCount} 条记录
          </div>
        )}
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" onClick={onExtrasClick} title="补充资料">
          <NoteIcon />
        </button>
        {!char.is_preset && (
          <>
            <button className="icon-btn" onClick={onEditClick} title="编辑">
              <EditIcon />
            </button>
            <button className="icon-btn" onClick={onDelete} title="删除">
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group, onClick, onDelete }: any) {
  return (
    <div className="list-card" onClick={onClick}>
      <div className="avatar">
        <GroupAvatar />
      </div>
      <div className="info">
        <div className="name">{group.name}</div>
        <div className="desc">
          {group.members?.length || 0} 个成员
          {group.description ? ` · ${group.description}` : ''}
        </div>
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" onClick={onDelete} title="删除">
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <section className="list-section">
      <div className="empty">
        <div className="empty-title">{title}</div>
        <div className="empty-subtitle">{subtitle}</div>
        <button className="empty-btn" onClick={onAction}>{actionLabel}</button>
      </div>
    </section>
  );
}

/* ============== SVG Icons (手写) ============== */

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function GroupAvatar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
