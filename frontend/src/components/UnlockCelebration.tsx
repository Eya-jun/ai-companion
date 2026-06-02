import { useEffect, useState } from 'react';
import { affinityApi } from '../api/client';

interface Props {
  characterId: string;
  characterName: string;
  characterAvatar: string;
  onClose: () => void;
}

export default function UnlockCelebration({ characterId, characterName, characterAvatar, onClose }: Props) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    affinityApi.getSpecialGreeting(characterId)
      .then(r => setGreeting(r.data.greeting))
      .catch(e => setGreeting('(生成问候失败: ' + e.message + ')'));
  }, [characterId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>{characterAvatar}</div>
        <h2 style={{ color: '#FF6B9D', margin: '0 0 16px' }}>💕 100% 达成!</h2>
        <p>你和 <strong>{characterName}</strong> 的亲密度达到顶峰,关系升级为:</p>
        <h3 style={{ color: '#FF6B9D' }}>亲密</h3>
        <div style={{ background: '#FFF0F5', padding: 16, borderRadius: 8, margin: '16px 0', fontStyle: 'italic', minHeight: 60 }}>
          {greeting ?? '生成中...'}
        </div>
        <button onClick={onClose} style={{ padding: '8px 24px', background: '#FF6B9D', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          开启我们的故事 →
        </button>
      </div>
    </div>
  );
}
