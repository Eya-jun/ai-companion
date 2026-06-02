import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, extrasApi, affinityApi } from '../api/client';
import type { AffinityState } from '../api/types';
import ExtraRow, { type Extra } from '../components/ExtraRow';
import './Extras.css';

const TABS = [
  { type: 'note' as const, label: '补充设定', desc: '语气、习惯、个性化设定' },
  { type: 'story' as const, label: '故事背景', desc: '你们之间发生过的故事' },
  { type: 'relationship' as const, label: '关系记录', desc: '关系进展、关键时刻' },
  { type: 'memory_hint' as const, label: '记忆提示', desc: '提醒 AI 注意的事' },
];

export default function CharacterExtras() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['type']>('note');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });
  const [affinity, setAffinity] = useState<AffinityState | null>(null);
  const [affinityBusy, setAffinityBusy] = useState(false);

  const load = async () => {
    if (!characterId) return;
    try {
      const [ch, ext, aff] = await Promise.all([
        charactersApi.get(characterId),
        extrasApi.list(characterId),
        affinityApi.get(characterId).catch(() => ({ data: null })),
      ]);
      setCharacter(ch.data);
      setExtras(ext.data);
      if (aff.data) setAffinity(aff.data);
    } catch (e: any) {
      alert('加载失败: ' + e.message);
    }
  };

  useEffect(() => { load(); }, [characterId]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !characterId) {
      alert('标题和内容必填');
      return;
    }
    try {
      if (editing) {
        await extrasApi.update(editing.id, form);
      } else {
        await extrasApi.create({ character_id: characterId, type: activeTab, ...form });
      }
      setShowModal(false);
      setEditing(null);
      setForm({ title: '', content: '' });
      await load();
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }
  };

  const handleAffinitySet = async (v: number) => {
    if (!characterId || affinityBusy) return;
    setAffinityBusy(true);
    try {
      const r = await affinityApi.set(characterId, v);
      setAffinity(s => s ? { ...s, affinity: r.data.affinity, stage: r.data.stage as any, unlockedAt: r.data.unlockedAt } : s);
      if (v >= 100) localStorage.removeItem(`seen_celebration_for_${characterId}`);
    } catch (e: any) {
      alert('设置失败: ' + e.message);
    } finally {
      setAffinityBusy(false);
    }
  };

  if (!character) return <div className="extras-loading">加载中...</div>;

  const filtered = extras.filter(e => e.type === activeTab);
  const activeInfo = TABS.find(t => t.type === activeTab)!;

  return (
    <div className="extras-page">
      <header className="extras-header">
        <button className="back-btn" onClick={() => navigate(`/chat/${characterId}`)}>←</button>
        <div className="extras-header-info">
          <strong>{character.name}</strong>
          <div style={{ fontSize: 11, color: '#888' }}>补充资料管理</div>
        </div>
        {activeTab !== 'relationship' && (
          <button className="btn-add" onClick={() => { setEditing(null); setForm({ title: '', content: '' }); setShowModal(true); }}>+ 新增</button>
        )}
        {activeTab === 'relationship' && <div style={{ width: 60 }} />}
      </header>

      {/* 4 Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #eee', overflowX: 'auto', background: 'white' }}>
        {TABS.map(tab => {
          const count = extras.filter(e => e.type === tab.type).length;
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              style={{
                padding: '10px 14px', border: 'none',
                borderBottom: activeTab === tab.type ? '2px solid #FF6B9D' : '2px solid transparent',
                marginBottom: -2, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontWeight: activeTab === tab.type ? 'bold' : 'normal',
                color: activeTab === tab.type ? '#FF6B9D' : '#666',
                fontSize: 13,
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{activeInfo.desc}</p>

        {/* 关系 tab:在 extras 列表上方嵌亲密度面板 */}
        {activeTab === 'relationship' && (
          <AffinityControlPanel
            affinity={affinity}
            busy={affinityBusy}
            onSet={handleAffinitySet}
          />
        )}

        {activeTab === 'relationship' && filtered.length > 0 && <div style={{ height: 12 }} />}

        {activeTab !== 'relationship' && filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>
            还没有{activeInfo.label},点右上角"+ 新增"开始
          </div>
        ) : activeTab === 'relationship' && filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '12px 0' }}>
            还没有{activeInfo.label},点上方"+ 新增"开始
          </div>
        ) : (
          filtered.map(e => (
            <ExtraRow key={e.id} extra={e} onUpdated={load} onDeleted={load} />
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑' : '新增'}{activeInfo.label}</h3>
            <div className="form-group">
              <label>标题 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>内容 *</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>取消</button>
              <button onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* 关系 tab 顶部的亲密度调整面板 */
function AffinityControlPanel({
  affinity, busy, onSet,
}: {
  affinity: AffinityState | null;
  busy: boolean;
  onSet: (v: number) => void;
}) {
  const STAGE_LABEL: Record<AffinityState['stage'], string> = {
    stranger: '陌生',
    familiar: '熟悉',
    flirtatious: '暧昧',
    intimate: '亲密',
  };
  const current = affinity?.affinity ?? 0;
  const stage = affinity?.stage ?? 'stranger';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 100%)',
      border: '1px solid #FFD9E5',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <strong style={{ fontSize: 14, color: '#FF6B9D' }}>当前亲密度</strong>
        <span style={{ fontSize: 12, color: '#888' }}>阶段:{STAGE_LABEL[stage]}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FF6B9D', marginBottom: 4 }}>
        {current}%
      </div>
      <div style={{ height: 8, background: '#FFD9E5', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${current}%`, height: '100%', background: 'linear-gradient(90deg, #FFD966, #FF6B9D)', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        {current < 100 ? `再 ${100 - current}% 解锁亲密模式` : '已达到 100%,亲密模式已解锁'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[0, 25, 50, 80, 100].map(v => (
          <button
            key={v}
            onClick={() => onSet(v)}
            disabled={busy}
            style={{
              flex: 1, minWidth: 50, padding: '6px 0',
              background: current === v ? '#FF6B9D' : 'white',
              color: current === v ? 'white' : '#FF6B9D',
              border: '1px solid #FF6B9D', borderRadius: 6,
              fontSize: 13, fontWeight: current === v ? 'bold' : 'normal',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >{v}</button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#999', marginTop: 8, marginBottom: 0 }}>
        默认由每日 2 点的 cron 评估增长;手动调只是临时调整,会被覆盖。
      </p>
    </div>
  );
}
