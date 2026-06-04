import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import styles from './Signup.module.css';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, displayName);
      navigate('/profile/setup');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell showTabBar={false} blobTheme="user">
      <div className={styles.page}>
        <ChatHeader
          title="注册"
          showBack
          onBack={() => navigate('/login')}
          right={false}
        />

        <div className={styles.body}>
          <div className={styles.intro}>
            <h1 className={styles.welcome}>创建账号</h1>
            <p className={styles.subtitle}>几秒钟,马上就能开始聊天</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.group}>
              <label className={styles.label}>昵称</label>
              <input
                type="text"
                className={styles.input}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="想让别人怎么叫你"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>邮箱</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>密码</label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 位"
                required
                minLength={6}
                disabled={loading}
              />
              <span className={styles.hint}>至少 6 位</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? '注册中…' : '注册'}
              </button>
            </div>
          </form>

          <p className={styles.foot}>
            已有账号?
            <a href="#/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
              登录
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
