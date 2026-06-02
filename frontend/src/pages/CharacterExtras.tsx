import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, extrasApi } from '../api/client';
import ExtraRow, { type Extra } from '../components/ExtraRow';
import './Extras.css';

const TABS = [
  { type: 'note' as const, label: '📝 补充设定', desc: '语气、习惯、个性化设定' },
  { type: 'story' as const, label: '📖 故事背景', desc: '你们之间发生过的故事' },
  { type: 'relationship' as const, label: '💕 关系记录', desc: '关系进展、关键时刻' },
  { type: 'memory_hint' as const, label: '💡 记忆提示', desc: '提醒 AI 注意的事' },
];

export default function CharacterExtras() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['type']>('note');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const load = async () => {
    if (!characterId) return;
    try {
      const [ch, ext] = await Promise.all([
        charactersApi.get(characterId),
        extrasApi.list(characterId),
      ]);
      setCharacter(ch.data);
      setExtras(ext.data);
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

  if (!character) return <div className="extras-loading">加载中...</div>;

  const filtered = extras.filter(e => e.type === activeTab);
  const activeInfo = TABS.find(t => t.type === activeTab)!;

  return (
    <div className="extras-page">
      <header className="extras-header">
        <button className="back-btn" onClick={() => navigate(`/chat/${characterId}`)}>←</button>
        <div className="extras-header-info">
          <strong>{character.name}</strong>
          <div style={{ fontSize: 11, color: '#888' }}>补充资料管理</div>
        </div>
        <button className="btn-add" onClick={() => { setEditing(null); setForm({ title: '', content: '' }); setShowModal(true); }}>+ 新增</button>
      </header>

      {/* 4 个 Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #eee', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const count = extras.filter(e => e.type === tab.type).length;
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              style={{
                padding: '10px 14px', border: 'none',
                borderBottom: activeTab === tab.type ? '2px solid #FF6B9D' : '2px solid transparent',
                marginBottom: -2,
                background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontWeight: activeTab === tab.type ? 'bold' : 'normal',
                color: activeTab === tab.type ? '#FF6B9D' : '#666',
                fontSize: 13,
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{activeInfo.desc}</p>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>
            还没有{activeInfo.label},点右上角"+ 新增"开始
          </div>
        ) : (
          filtered.map(e => (
            <ExtraRow key={e.id} extra={e} onUpdated={load} onDeleted={load} />
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑' : '新增'}{activeInfo.label}</h3>
            <div className="form-group">
              <label>标题 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>内容 *</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>取消</button>
              <button onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
