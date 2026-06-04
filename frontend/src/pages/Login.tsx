import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    console.log('[Login] start', { email });
    try {
      await login(email, password);
      console.log('[Login] success, navigating to /');
      navigate('/');
    } catch (e: any) {
      console.log('[Login] error:', e);
      setError(e.message);
    } finally {
      console.log('[Login] finally, clearing loading');
      setLoading(false);
    }
  };

  return (
    <AppShell showTabBar={false} blobTheme="user">
      <div className={styles.page}>
        {/* 登录是首屏,不显示返回箭头;右侧用空占位隐藏 ChatHeader 的默认"更多"按钮 */}
        <ChatHeader title="登录" showBack={false} right={false} />

        <div className={styles.body}>
          <div className={styles.intro}>
            <h1 className={styles.welcome}>欢迎回来</h1>
            <p className={styles.subtitle}>登录后继续和你的角色聊天</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
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
                placeholder="••••••"
                required
                disabled={loading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? '登录中…' : '登录'}
              </button>
            </div>
          </form>

          <p className={styles.foot}>
            还没有账号?
            <a href="#/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>
              注册
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
