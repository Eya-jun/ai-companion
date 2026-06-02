import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, extrasApi } from '../api/client';
import './Extras.css';

interface CharacterExtra {
  id: string;
  character_id: string;
  type: 'note' | 'story' | 'relationship' | 'memory_hint';
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const TYPE_INFO = {
  note: { icon: '📝', label: '补充设定', desc: '语气、习惯、个性化设定（不影响 LLM 行为）', color: '#FFD966' },
  story: { icon: '📖', label: '故事背景', desc: '你们之间发生过的故事、经历', color: '#FF9F43' },
  relationship: { icon: '💕', label: '关系记录', desc: '关系进展、关键时刻', color: '#FF6B9D' },
  memory_hint: { icon: '💡', label: '记忆提示', desc: '提醒 AI 注意的事（如她的喜好、忌讳）', color: '#88D066' },
};

export default function CharacterExtras() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [extras, setExtras] = useState<CharacterExtra[]>([]);
  const [editing, setEditing] = useState<CharacterExtra | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    type: 'note' as 'note' | 'story' | 'relationship' | 'memory_hint',
    title: '',
    content: '',
  });

  useEffect(() => {
    if (characterId) {
      loadAll();
    }
  }, [characterId]);

  const loadAll = async () => {
    if (!characterId) return;
    try {
      const [char, ext] = await Promise.all([
        charactersApi.get(characterId),
        extrasApi.list(characterId),
      ]);
      setCharacter(char.data);
      setExtras(ext.data);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim() || !characterId) {
      alert('标题和内容必填');
      return;
    }

    try {
      if (editing) {
        await extrasApi.update(editing.id, form);
      } else {
        await extrasApi.create({
          character_id: characterId,
          ...form,
        });
      }
      setShowAddModal(false);
      setEditing(null);
      setForm({ type: 'note', title: '', content: '' });
      await loadAll();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    }
  };

  const handleEdit = (extra: CharacterExtra) => {
    setEditing(extra);
    setForm({
      type: extra.type,
      title: extra.title,
      content: extra.content,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try {
      await extrasApi.delete(id);
      await loadAll();
    } catch (e: any) {
      alert('删除失败：' + e.message);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ type: 'note', title: '', content: '' });
    setShowAddModal(true);
  };

  if (!character) {
    return <div className="extras-loading">加载中...</div>;
  }

  // 按类型分组
  const grouped = {
    note: extras.filter(e => e.type === 'note'),
    story: extras.filter(e => e.type === 'story'),
    relationship: extras.filter(e => e.type === 'relationship'),
    memory_hint: extras.filter(e => e.type === 'memory_hint'),
  };

  return (
    <div className="extras-page">
      <header className="extras-header">
        <button className="back-btn" onClick={() => navigate(`/chat/${characterId}`)}>←</button>
        <div className="extras-header-info">
          <div className="extras-header-avatar">
            {character.avatar?.startsWith('data:image') ? (
              <img src={character.avatar} alt={character.name} />
            ) : (
              <span style={{ fontSize: '24px' }}>{character.avatar}</span>
            )}
          </div>
          <div>
            <div className="extras-header-name">{character.name}</div>
            <div className="extras-header-desc">补充资料管理</div>
          </div>
        </div>
        <button className="btn-add" onClick={openAdd}>+ 新增</button>
      </header>

      <div className="extras-intro">
        💡 这里存储的内容会在每次对话时<strong>自动拼接到 system_prompt</strong>之后,
        AI 会按类型分别看到: 📝 补充设定、📖 故事背景、💕 关系记录、💡 记忆提示。
        因此请只写与角色相关、不会让 AI"出戏"的内容。
      </div>

      <div className="extras-content">
        {(['note', 'story', 'relationship', 'memory_hint'] as const).map(type => {
          const info = TYPE_INFO[type];
          const items = grouped[type];
          return (
            <section key={type} className="extras-section">
              <h2 className="extras-section-title">
                <span className="section-icon" style={{ background: info.color }}>{info.icon}</span>
                {info.label} <span className="count">({items.length})</span>
              </h2>
              <p className="extras-section-desc">{info.desc}</p>

              {items.length === 0 ? (
                <div className="extras-empty">还没有{info.label}</div>
              ) : (
                <div className="extras-list">
                  {items.map(item => (
                    <div key={item.id} className="extras-card" style={{ borderLeftColor: info.color }}>
                      <div className="extras-card-header">
                        <div className="extras-card-title">{item.title}</div>
                        <div className="extras-card-actions">
                          <button onClick={() => handleEdit(item)} title="编辑">✏️</button>
                          <button onClick={() => handleDelete(item.id)} title="删除">🗑️</button>
                        </div>
                      </div>
                      <div className="extras-card-content">{item.content}</div>
                      <div className="extras-card-time">
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑' : '新增'}补充资料</h3>

            <div className="form-group">
              <label>类型</label>
              <div className="type-picker">
                {(Object.keys(TYPE_INFO) as Array<keyof typeof TYPE_INFO>).map(t => {
                  const info = TYPE_INFO[t];
                  return (
                    <div
                      key={t}
                      className={`type-option ${form.type === t ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, type: t })}
                      style={{ borderColor: form.type === t ? info.color : 'transparent' }}
                    >
                      <span style={{ background: info.color }} className="type-icon">{info.icon}</span>
                      <span>{info.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>标题 *</label>
              <input
                type="text"
                className="form-input"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="简短标题"
              />
            </div>

            <div className="form-group">
              <label>内容 *</label>
              <textarea
                className="form-textarea"
                rows={6}
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="详细描述..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-confirm" onClick={handleSubmit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
