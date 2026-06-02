import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function UserProfileSetup() {
  const navigate = useNavigate();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [preferredName, setPreferredName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { refreshProfile(); }, []);

  useEffect(() => {
    if (profile) {
      setPreferredName(profile.preferred_name ?? '');
      setOccupation(profile.occupation ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  if (!profile) return <div style={{ padding: 40 }}>加载中...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferredName.trim()) {
      setError('称呼是必填的——AI 需要知道怎么叫你');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        preferred_name: preferredName,
        occupation: occupation || null,
        bio: bio || null,
      });
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24 }}>
      <h2>欢迎,{profile.display_name} 👋</h2>
      <p>为了让 AI 更了解你,先填几个关键信息。称呼是必填的,其他可以之后在"我的资料"里改。</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>AI 怎么称呼你? *<br />
            <input value={preferredName} onChange={e => setPreferredName(e.target.value)} required placeholder="如:小美 / 阿月" style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>身份(学生/上班族/...)<br />
            <input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="如:大三学生" style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>自我介绍(简单说说自己)<br />
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={saving} style={{ padding: '8px 20px' }}>
          {saving ? '保存中...' : '开始聊天 →'}
        </button>
      </form>
    </div>
  );
}
