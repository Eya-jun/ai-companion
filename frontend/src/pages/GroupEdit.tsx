import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { charactersApi, groupsApi } from '../api/client';
import type { Character } from '../api/types';
import './Edit.css';

export default function GroupEdit() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const res = await charactersApi.list();
      setCharacters(res.data);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
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
      alert('创建失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-page">
      <header className="edit-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h2>新建群聊</h2>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={loading}
        >
          {loading ? '创建中...' : '创建'}
        </button>
      </header>

      <div className="edit-form">
        <div className="form-group">
          <label>群名 *</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="群聊名称"
          />
        </div>

        <div className="form-group">
          <label>描述</label>
          <input
            type="text"
            className="form-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="群聊描述（可选）"
          />
        </div>

        <div className="form-group">
          <label>选择成员（至少2个）*</label>
          <div className="character-selector">
            {characters.map(c => (
              <div
                key={c.id}
                className={`selector-item ${selected.has(c.id) ? 'selected' : ''}`}
                onClick={() => toggleSelect(c.id)}
              >
                <div className="selector-avatar">{c.avatar}</div>
                <div className="selector-name">{c.name}</div>
                <div className="selector-desc">{c.description}</div>
                {selected.has(c.id) && <div className="selector-check">✓</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
