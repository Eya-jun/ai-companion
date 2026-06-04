import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import styles from './UserProfileSetup.module.css';

export default function UserProfileSetup() {
  const navigate = useNavigate();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    display_name: '',
    preferred_name: '',
    gender: '',
    age: '',
    occupation: '',
    mbti: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { refreshProfile(); }, []);

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

  if (!profile) {
    return (
      <AppShell showTabBar={false} blobTheme="user">
        <div className={styles.loading}>加载中…</div>
      </AppShell>
    );
  }

  const onField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim()) {
      setError('昵称是必填的——AI 需要知道怎么叫你');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        display_name: form.display_name.trim() || null,
        preferred_name: form.preferred_name.trim() || null,
        gender: form.gender.trim() || null,
        age: form.age ? parseInt(form.age, 10) : null,
        occupation: form.occupation.trim() || null,
        mbti: form.mbti.trim().toUpperCase() || null,
        bio: form.bio.trim() || null,
      });
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell showTabBar={false} blobTheme="user">
      <div className={styles.page}>
        {/* 注册后强制流程,不显示返回 */}
        <ChatHeader title="完善资料" showBack={false} right={false} />

        <div className={styles.body}>
          <div className={styles.intro}>
            <h1 className={styles.welcome}>
              欢迎,<span className={styles['welcome-name']}>{profile.display_name || '朋友'}</span>
            </h1>
            <p className={styles.subtitle}>
              先填几个关键信息,AI 就能更懂你。昵称必填,其他之后在「我的资料」里改。
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.group}>
              <label className={styles.label}>
                昵称<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                value={form.display_name}
                onChange={onField('display_name')}
                placeholder="对外展示的名字"
                required
                disabled={saving}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>AI 怎么称呼你</label>
              <input
                className={styles.input}
                value={form.preferred_name}
                onChange={onField('preferred_name')}
                placeholder="如:小美 / 阿月"
                disabled={saving}
              />
              <span className={styles.hint}>空了就用上面的昵称</span>
            </div>

            <div className={styles.row}>
              <div className={styles.group}>
                <label className={styles.label}>性别</label>
                <input
                  className={styles.input}
                  value={form.gender}
                  onChange={onField('gender')}
                  placeholder="男 / 女 / 其他"
                  disabled={saving}
                />
              </div>
              <div className={styles.group}>
                <label className={styles.label}>年龄</label>
                <input
                  className={styles.input}
                  value={form.age}
                  onChange={onField('age')}
                  placeholder="数字"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>身份</label>
              <input
                className={styles.input}
                value={form.occupation}
                onChange={onField('occupation')}
                placeholder="如:大三学生 / 产品经理"
                disabled={saving}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>MBTI</label>
              <input
                className={styles.input}
                value={form.mbti}
                onChange={onField('mbti')}
                placeholder="如:INFP"
                maxLength={4}
                disabled={saving}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>自我介绍</label>
              <textarea
                className={styles.textarea}
                value={form.bio}
                onChange={onField('bio')}
                rows={3}
                placeholder="一句话介绍自己,AI 会记住"
                disabled={saving}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.btn} ${styles['btn-primary']}`}
                disabled={saving}
              >
                {saving ? '保存中…' : '开始聊天'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
