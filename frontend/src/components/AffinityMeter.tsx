import type { AffinityStage } from '../api/types';

interface Props {
  affinity: number;
  stage: AffinityStage;
  variant: 'card' | 'header' | 'compact';
}

const STAGE_LABEL: Record<AffinityStage, string> = {
  stranger: '陌生',
  familiar: '熟悉',
  flirtatious: '暧昧',
  intimate: '亲密',
};

export default function AffinityMeter({ affinity, stage, variant }: Props) {
  if (variant === 'card') {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, affinity))}%`, height: '100%', background: 'linear-gradient(90deg, #FFD966, #FF6B9D)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#888' }}>
          <span>💕 {STAGE_LABEL[stage]}中 {affinity}%</span>
          <span>再 {Math.max(0, 100 - affinity)}% 解锁亲密</span>
        </div>
      </div>
    );
  }
  if (variant === 'header') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: 4, width: 80, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, affinity))}%`, height: '100%', background: 'linear-gradient(90deg, #FFD966, #FF6B9D)' }} />
        </div>
        <span style={{ fontSize: 11, color: '#FF6B9D', fontWeight: 'bold' }}>{STAGE_LABEL[stage]} {affinity}%</span>
      </div>
    );
  }
  return <span style={{ color: '#FF6B9D' }}>💕 {affinity}%</span>;
}
