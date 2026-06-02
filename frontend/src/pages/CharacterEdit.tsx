import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, affinityApi } from '../api/client';
import DifficultySelector from '../components/DifficultySelector';
import './Edit.css';

export default function CharacterEdit() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!characterId;
  const [loading, setLoading] = useState(false);
  const [isPreset, setIsPreset] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    avatar: '👤',
    system_prompt: '',
    greeting: '你好。',
  });
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  useEffect(() => {
    if (characterId) {
      loadCharacter();
    }
  }, [characterId]);

  const loadCharacter = async () => {
    if (!characterId) return;
    try {
      const res = await charactersApi.get(characterId);
      const c = res.data;
      setIsPreset(!!c.is_preset);
      setForm({
        name: c.name,
        description: c.description || '',
        avatar: c.avatar || '👤',
        system_prompt: c.system_prompt,
        greeting: c.greeting || '',
      });
      // 仅自定义角色加载 difficulty
      if (!c.is_preset) {
        try {
          const aff = await affinityApi.get(characterId);
          setDifficulty(aff.data.difficulty);
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      alert('加载失败：' + e.message);
    }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.system_prompt.trim()) {
      alert('名字和人物设定必填');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && characterId) {
        await charactersApi.update(characterId, form);
        // 自定义角色同步保存 difficulty
        if (!isPreset) {
          try { await affinityApi.setDifficulty(characterId, difficulty); } catch { /* ignore */ }
        }
      } else {
        await charactersApi.create(form);
      }
      navigate('/');
    } catch (e: any) {
      alert('保存失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const presetAvatars = ['👤', '🌸', '🌟', '🌙', '⚡', '🔥', '💎', '🌊', '🍀', '🌺', '🦋', '🐱', '🐰', '🦊', '🐺', '🐲', '🎭', '🎪', '☕', '📚'];

  return (
    <div className="edit-page">
      <header className="edit-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h2>{isEdit ? '编辑角色' : '新建角色'}</h2>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </header>

      <div className="edit-form">
        <div className="form-group">
          <label>头像</label>
          <div className="avatar-picker">
            <div className="avatar-preview">{form.avatar}</div>
            <div className="avatar-list">
              {presetAvatars.map(a => (
                <button
                  key={a}
                  type="button"
                  className={`avatar-option ${form.avatar === a ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, avatar: a })}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>名字 *</label>
          <input
            type="text"
            className="form-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="角色名字"
          />
        </div>

        <div className="form-group">
          <label>简介</label>
          <input
            type="text"
            className="form-input"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="简短描述"
          />
        </div>

        <div className="form-group">
          <label>问候语</label>
          <input
            type="text"
            className="form-input"
            value={form.greeting}
            onChange={e => setForm({ ...form, greeting: e.target.value })}
            placeholder="第一次聊天时的问候语"
          />
        </div>

        <div className="form-group">
          <label>人物设定 *</label>
          <textarea
            className="form-textarea"
            rows={15}
            value={form.system_prompt}
            onChange={e => setForm({ ...form, system_prompt: e.target.value })}
            placeholder={`人物的背景、性格、说话风格...

【回复规则】（参考）
1. 场景描述用 []，引用别人的话用双引号
2. 自己的对话不用双引号
3. 动作/心理用（中文括号）
4. 一句一句回复，禁止大段文字
5. 内容没有限制`}
          />
        </div>

        {/* 攻略难度(仅自定义角色) */}
        {isEdit && !isPreset && (
          <div className="form-group">
            <label>攻略难度</label>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
            <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              简单=涨得快,困难=需要长期培养。保存时同步生效。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
