import { useState } from 'react';
import { affinityApi } from '../api/client';

interface Props {
  characterId: string;
  mode: 'daily' | 'intimate';
  onChange: (m: 'daily' | 'intimate') => void;
}

export default function IntimateModeToggle({ characterId, mode, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const handle = async (m: 'daily' | 'intimate') => {
    if (m === mode || loading) return;
    setLoading(true);
    try {
      await affinityApi.setMode(characterId, m);
      onChange(m);
    } catch (e: any) {
      alert('切换失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #FF6B9D', borderRadius: 16, overflow: 'hidden', fontSize: 12 }}>
      <button onClick={() => handle('daily')} disabled={loading}
        style={{ padding: '4px 10px', border: 'none', background: mode === 'daily' ? '#FF6B9D' : 'transparent', color: mode === 'daily' ? 'white' : '#FF6B9D', cursor: 'pointer' }}>
        💖 日常
      </button>
      <button onClick={() => handle('intimate')} disabled={loading}
        style={{ padding: '4px 10px', border: 'none', background: mode === 'intimate' ? '#FF6B9D' : 'transparent', color: mode === 'intimate' ? 'white' : '#FF6B9D', cursor: 'pointer' }}>
        💕 亲密
      </button>
    </div>
  );
}
