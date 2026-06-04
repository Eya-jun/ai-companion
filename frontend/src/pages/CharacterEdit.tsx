import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, affinityApi, avatarsApi } from '../api/client';
import type { Character } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import DifficultySelector from '../components/DifficultySelector';
import styles from './CharacterEdit.module.css';

const AVATAR_OPTIONS = ['👤', '🌸', '🌟', '🌙', '⚡', '🔥', '💎', '🌊', '🍀', '🌺', '🦋', '🐱', '🐰', '🦊', '🐺', '🐲', '🎭', '🎪', '☕', '📚'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function CharacterEdit() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!characterId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isPreset, setIsPreset] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    avatar: '👤',
    system_prompt: '',
    greeting: '你好。',
  });
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
      const c: Character = res.data;
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
      let targetId = characterId;
      if (isEdit && characterId) {
        await charactersApi.update(characterId, form);
        // 自定义角色同步保存 difficulty
        if (!isPreset) {
          try { await affinityApi.setDifficulty(characterId, difficulty); } catch { /* ignore */ }
        }
      } else {
        const created = await charactersApi.create(form);
        targetId = created.data.id;
      }
      // 头像有挂起的本地文件才上传
      if (pendingAvatarFile && targetId) {
        try {
          const res = await avatarsApi.uploadCharacterAvatar(targetId, pendingAvatarFile);
          // 用返回的新 URL 覆盖(后端会更新数据库,前端 form 也保持一致)
          setForm((f) => ({ ...f, avatar: res.data.url }));
        } catch (e: any) {
          alert('头像上传失败: ' + e.message);
        }
      }
      navigate(-1);
    } catch (e: any) {
      alert('保存失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const onField = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const isImageAvatar = (s: string) => s.startsWith('data:image') || /^https?:\/\//.test(s);

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 重置 input value,允许同一文件再次选择
    if (e.target) e.target.value = '';
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      alert('文件超过 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((f) => ({ ...f, avatar: dataUrl }));
      setPendingAvatarFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiPick = (emoji: string) => {
    setForm({ ...form, avatar: emoji });
    setPendingAvatarFile(null);
  };

  return (
    <AppShell showTabBar={false} blobTheme="a">
      <div className={styles.page}>
        <ChatHeader title={isEdit ? '编辑角色' : '新建角色'} showBack />

        <div className={styles.body}>
          <div className={styles.group}>
            <label className={styles.label}>头像</label>
            <div className={styles['avatar-picker']}>
              <div className={styles['avatar-preview']}>
                {isImageAvatar(form.avatar) ? (
                  <img src={form.avatar} alt="头像预览" className={styles['avatar-preview-img']} />
                ) : (
                  <span className={styles['avatar-preview-emoji']}>{form.avatar}</span>
                )}
              </div>

              <div className={styles['avatar-actions']}>
                <button
                  type="button"
                  className={`${styles['avatar-action-btn']} ${showEmojiPicker ? styles.active : ''}`}
                  onClick={() => setShowEmojiPicker((s) => !s)}
                >
                  {showEmojiPicker ? '收起表情' : '从表情中选择'}
                </button>
                <button
                  type="button"
                  className={styles['avatar-action-btn']}
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传本地图片
                </button>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={fileInputRef}
                  onChange={handleFilePicked}
                />
              </div>

              {showEmojiPicker && (
                <div className={styles['avatar-list']}>
                  {AVATAR_OPTIONS.map(a => (
                    <button
                      key={a}
                      type="button"
                      className={`${styles['avatar-option']} ${form.avatar === a ? styles.active : ''}`}
                      onClick={() => handleEmojiPick(a)}
                      aria-label={`选择头像 ${a}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>
              名字<span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={form.name}
              onChange={onField('name')}
              placeholder="角色名字"
              disabled={isPreset}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>简介</label>
            <input
              type="text"
              className={styles.input}
              value={form.description}
              onChange={onField('description')}
              placeholder="简短描述"
              disabled={isPreset}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>问候语</label>
            <input
              type="text"
              className={styles.input}
              value={form.greeting}
              onChange={onField('greeting')}
              placeholder="第一次聊天时的问候语"
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>
              人物设定<span className={styles.required}>*</span>
            </label>
            <textarea
              className={`${styles.textarea} ${styles['textarea-lg']}`}
              rows={15}
              value={form.system_prompt}
              onChange={onField('system_prompt')}
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
            <div className={styles.group}>
              <label className={styles.label}>攻略难度</label>
              <DifficultySelector value={difficulty} onChange={setDifficulty} />
              <p className={styles.hint}>
                简单=涨得快，困难=需要长期培养。保存时同步生效。
              </p>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn-secondary']}`}
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn-primary']}`}
            onClick={submit}
            disabled={loading}
          >
            {loading ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
