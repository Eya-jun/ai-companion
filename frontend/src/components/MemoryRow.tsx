import { useState } from 'react';
import { memoriesApi } from '../api/client';

export interface Memory {
  id: string;
  character_id: string;
  memory_date: string;
  summary: string;
  affinity_delta: number | null;
  affinity_reason: string | null;
  source: 'ai' | 'user';
}

interface Props {
  memory: Memory;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function MemoryRow({ memory, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.summary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      alert('内容不能为空');
      return;
    }
    setSaving(true);
    try {
      await memoriesApi.update(memory.id, { summary: text });
      onUpdated();
      setEditing(false);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除？')) return;
    try {
      await memoriesApi.delete(memory.id);
      onDeleted();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  if (editing) {
    return (
      <div style={{ background: 'white', borderLeft: '3px solid #FF6B9D', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
            else if (e.key === 'Escape') { setText(memory.summary); setEditing(false); }
          }}
          rows={4}
          autoFocus
          style={{ width: '100%', padding: 6, fontSize: 12 }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
          Ctrl+Enter 保存,Esc 取消 {saving && '· 保存中...'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderLeft: '3px solid #FF6B9D', padding: 10, borderRadius: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>
          📔 {memory.memory_date}
          {memory.source === 'user' && <span style={{ fontSize: 10, color: '#999', marginLeft: 6 }}>(手动)</span>}
        </strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => setEditing(true)} title="编辑">✏️</span>
          <span style={{ cursor: 'pointer' }} onClick={handleDelete} title="删除">🗑️</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.5 }}>{memory.summary}</div>
      {memory.affinity_reason && (
        <div style={{ fontSize: 10, color: '#FF6B9D', marginTop: 4 }}>
          💕 {(memory.affinity_delta ?? 0) >= 0 ? '+' : ''}{memory.affinity_delta} · {memory.affinity_reason}
        </div>
      )}
    </div>
  );
}
