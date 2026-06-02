import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppHeader() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #eee' }}>
      <div style={{ fontSize: 14, color: '#666' }}>💕 AI 伴侣</div>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#999' }}>
              {profile.display_name?.charAt(0) ?? '?'}
            </div>
          )}
        </button>
        {open && (
          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #ddd', borderRadius: 6, padding: 4, zIndex: 100, minWidth: 140 }}>
            <div style={{ padding: '6px 10px', fontSize: 12, color: '#666' }}>{profile.display_name}</div>
            <button onClick={() => { setOpen(false); navigate('/profile'); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
              我的资料
            </button>
            <button onClick={async () => { setOpen(false); await logout(); navigate('/login'); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'red', fontSize: 14 }}>
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
