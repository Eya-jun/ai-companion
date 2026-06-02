import { useState } from 'react';
import { extrasApi } from '../api/client';

export interface Extra {
  id: string;
  character_id: string;
  type: 'note' | 'story' | 'relationship' | 'memory_hint';
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  extra: Extra;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function ExtraRow({ extra, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(extra.title);
  const [content, setContent] = useState(extra.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('标题和内容必填');
      return;
    }
    setSaving(true);
    try {
      await extrasApi.update(extra.id, { title, content });
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
      await extrasApi.delete(extra.id);
      onDeleted();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  if (editing) {
    return (
      <div style={{ background: 'white', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setTitle(extra.title); setContent(extra.content); setEditing(false); }
          }}
          autoFocus
          style={{ width: '100%', padding: 6, marginBottom: 6, fontSize: 13, fontWeight: 'bold' }}
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
            else if (e.key === 'Escape') { setTitle(extra.title); setContent(extra.content); setEditing(false); }
          }}
          rows={3}
          style={{ width: '100%', padding: 6, fontSize: 12 }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
          Ctrl+Enter 保存,Esc 取消 {saving && '· 保存中...'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: 10, borderRadius: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>{extra.title}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => setEditing(true)} title="编辑">✏️</span>
          <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={handleDelete} title="删除">🗑️</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{extra.content}</div>
      <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
        {new Date(extra.created_at).toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
