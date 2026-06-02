import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
      <h2>注册</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>邮箱<br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>密码(至少 6 位)<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>昵称<br />
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        已有账号? <a href="#/login">登录</a>
      </p>
    </div>
  );
}
