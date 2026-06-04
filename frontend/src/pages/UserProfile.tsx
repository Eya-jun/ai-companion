import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { profileApi } from '../api/client';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import styles from './UserProfile.module.css';

export default function UserProfile() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: '', preferred_name: '', gender: '', age: '',
    occupation: '', mbti: '', bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? '',
        preferred_name: profile.preferred_name ?? '',
        gender: profile.gender ?? '',
        age: profile.age?.toString() ?? '',
        occupation: profile.occupation ?? '',
        mbti: profile.mbti ?? '',
        bio: profile.bio ?? '',
      });
    }
  }, [profile]);

  if (!profile) return <div className={styles.loading}>加载中...</div>;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await updateProfile({
        display_name: form.display_name || null,
        preferred_name: form.preferred_name || null,
        gender: form.gender || null,
        age: form.age ? parseInt(form.age, 10) : null,
        occupation: form.occupation || null,
        mbti: form.mbti || null,
        bio: form.bio || null,
      });
      setMsg({ text: '已保存', tone: 'ok' });
      setTimeout(() => navigate(-1), 600);
    } catch (e: any) {
      setMsg({ text: '保存失败: ' + e.message, tone: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      await profileApi.uploadAvatar(file);
      await refreshProfile();
      setMsg({ text: '头像已更新', tone: 'ok' });
    } catch (e: any) {
      setMsg({ text: '上传失败: ' + e.message, tone: 'err' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell showTabBar={false} blobTheme="user">
      <div className={styles.page}>
        <ChatHeader
          title="我的资料"
          subtitle={profile.display_name || ''}
          showBack
        />

        <div className={styles.body}>
          {/* 头像卡 */}
          <div className={styles['avatar-card']}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="头像" className={styles['avatar-img']} />
            ) : (
              <div className={styles['avatar-placeholder']}>?</div>
            )}
            <div className={styles['avatar-info']}>
              <div className={styles['avatar-name']}>{profile.display_name || '未设置昵称'}</div>
              <div className={styles['avatar-hint']}>支持 jpg / png / webp · 最大 2MB</div>
              <button
                type="button"
                className={styles['avatar-change']}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? '上传中…' : '更换'}
              </button>
              <input
                type="file"
                ref={fileRef}
                accept="image/*"
                onChange={handleAvatar}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>昵称</label>
            <input
              className={styles.input}
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              placeholder="对外展示的名字"
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>称呼（让 AI 怎么叫你）</label>
            <input
              className={styles.input}
              value={form.preferred_name}
              onChange={e => setForm({ ...form, preferred_name: e.target.value })}
              placeholder="如：小美 / 阿月"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.group}>
              <label className={styles.label}>性别</label>
              <input
                className={styles.input}
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value })}
                placeholder="男 / 女 / 其他"
              />
            </div>
            <div className={styles.group}>
              <label className={styles.label}>年龄</label>
              <input
                className={styles.input}
                value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })}
                placeholder="数字"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>身份（学生 / 上班族 / …）</label>
            <input
              className={styles.input}
              value={form.occupation}
              onChange={e => setForm({ ...form, occupation: e.target.value })}
              placeholder="职业 / 角色"
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>MBTI</label>
            <input
              className={styles.input}
              value={form.mbti}
              onChange={e => setForm({ ...form, mbti: e.target.value.toUpperCase() })}
              placeholder="如：INFP"
              maxLength={4}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>自我介绍</label>
            <textarea
              className={`${styles.textarea}`}
              rows={4}
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              placeholder="一句话介绍一下自己"
            />
          </div>

          {msg && (
            <div className={`${styles.msg} ${msg.tone === 'err' ? styles['msg-err'] : styles['msg-ok']}`}>
              {msg.text}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn-secondary']}`}
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles['btn-primary']}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
