import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { profileApi } from '../api/client';

export default function UserProfile() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: '', preferred_name: '', gender: '', age: '',
    occupation: '', mbti: '', bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  if (!profile) return <div style={{ padding: 40 }}>加载中...</div>;

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
      setMsg('已保存');
    } catch (e: any) {
      setMsg('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await profileApi.uploadAvatar(file);
      await refreshProfile();
      setMsg('头像已更新');
    } catch (e: any) {
      setMsg('上传失败: ' + e.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>我的用户卡</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#999' }}>?</div>
        )}
        <input type="file" ref={fileRef} accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}>更换头像</button>
      </div>

      <Field label="昵称" value={form.display_name} onChange={v => setForm({ ...form, display_name: v })} />
      <Field label="称呼(让 AI 怎么叫你)" value={form.preferred_name} onChange={v => setForm({ ...form, preferred_name: v })} placeholder="如:小美 / 阿月" />
      <Field label="性别" value={form.gender} onChange={v => setForm({ ...form, gender: v })} />
      <Field label="年龄" value={form.age} onChange={v => setForm({ ...form, age: v })} />
      <Field label="身份(学生/上班族/...)" value={form.occupation} onChange={v => setForm({ ...form, occupation: v })} />
      <Field label="MBTI" value={form.mbti} onChange={v => setForm({ ...form, mbti: v })} />

      <div style={{ marginBottom: 12 }}>
        <label>自我介绍<br />
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} style={{ width: '100%', padding: 8 }} />
        </label>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px' }}>
        {saving ? '保存中...' : '保存'}
      </button>
      {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label>{label}<br />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: 8 }} />
      </label>
    </div>
  );
}