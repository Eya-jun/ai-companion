import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { memoriesApi, charactersApi } from '../api/client';
import MemoryRow, { type Memory } from '../components/MemoryRow';

export default function Memories() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');

  const load = async () => {
    if (!characterId) return;
    const [ch, mem] = await Promise.all([
      charactersApi.get(characterId),
      memoriesApi.list(characterId),
    ]);
    setCharacter(ch.data);
    setMemories(mem.data);
  };

  useEffect(() => { load(); }, [characterId]);

  // 按月分组(YYYY-MM 倒序)
  const grouped = useMemo(() => {
    const map = new Map<string, Memory[]>();
    memories.forEach(m => {
      const ym = (m.memory_date || '').substring(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [memories]);

  const handleAdd = async () => {
    if (!newText.trim() || !characterId) return;
    try {
      await memoriesApi.add(characterId, newDate, newText);
      setAdding(false);
      setNewText('');
      await load();
    } catch (e: any) {
      alert('新增失败: ' + e.message);
    }
  };

  if (!character) return <div style={{ padding: 40 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => navigate(`/chat/${characterId}`)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>←</button>
        <strong>{character.name} 的记忆</strong>
        <button onClick={() => setAdding(true)} style={{ background: '#FF6B9D', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>+ 新增</button>
      </div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>共 {memories.length} 条记忆</div>

      {adding && (
        <div style={{ background: 'white', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #FFD9E5' }}>
          <div style={{ marginBottom: 6, fontSize: 12 }}>
            日期:<input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ marginLeft: 8, padding: 4 }} />
          </div>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            rows={4}
            placeholder="写下你想记住的事..."
            style={{ width: '100%', padding: 6, fontSize: 13 }}
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button onClick={() => setAdding(false)} style={{ marginRight: 8 }}>取消</button>
            <button onClick={handleAdd} style={{ background: '#FF6B9D', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>保存</button>
          </div>
        </div>
      )}

      {grouped.length === 0 && !adding && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>
          还没有记忆。可以点右上角"+ 新增"手动加,或者每天 2 点 cron 会自动评估昨天对话。
        </div>
      )}

      {grouped.map(([ym, items]) => {
        const isCollapsed = collapsed[ym];
        return (
          <div key={ym} style={{ marginBottom: 8 }}>
            <div
              onClick={() => setCollapsed({ ...collapsed, [ym]: !isCollapsed })}
              style={{ background: 'white', padding: 10, borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
            >
              <strong style={{ fontSize: 13 }}>📅 {ym}</strong>
              <span style={{ fontSize: 12, color: '#999' }}>{isCollapsed ? '▶' : '▼'} ({items.length})</span>
            </div>
            {!isCollapsed && (
              <div style={{ paddingLeft: 12, marginTop: 6 }}>
                {items.map(m => (
                  <MemoryRow key={m.id} memory={m} onUpdated={load} onDeleted={load} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
