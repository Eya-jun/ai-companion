import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, chatApi, memoriesApi } from '../api/client';
import type { Character, Message, LLMProvider } from '../api/types';
import MessageBubble from '../components/MessageBubble';
import './Chat.css';

export default function Chat() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<LLMProvider>('kimi');
  const [latestMemory, setLatestMemory] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!characterId) return;
    loadAll();
  }, [characterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAll = async () => {
    if (!characterId) return;
    try {
      const [char, msgs, mem] = await Promise.all([
        charactersApi.get(characterId),
        chatApi.getMessages(characterId),
        memoriesApi.latest(characterId).catch(() => ({ data: null })),
      ]);
      setCharacter(char.data);
      setMessages(msgs.data);
      setLatestMemory(mem.data);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    }
  };

  const send = async () => {
    if (!input.trim() || !characterId || loading) return;
    const userText = input.trim();
    setInput('');
    setLoading(true);

    // 乐观更新
    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      character_id: characterId,
      role: 'user',
      content: userText,
      sender_type: 'user',
      sender_name: '我',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await chatApi.send(characterId, userText, model);
      const aiMsg: Message = {
        id: 'temp-ai-' + Date.now(),
        character_id: characterId,
        role: 'assistant',
        content: res.data.aiResponse,
        sender_type: 'character',
        sender_name: character?.name || 'AI',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      alert('发送失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!characterId) return;
    if (!confirm('生成今天的记忆总结？')) return;
    try {
      const res = await memoriesApi.summarize(characterId, undefined, model);
      setLatestMemory(res.data);
      alert('记忆已生成！');
    } catch (e: any) {
      alert('生成失败：' + e.message);
    }
  };

  const handleClear = async () => {
    if (!characterId) return;
    if (!confirm('清除所有聊天记录？')) return;
    try {
      await chatApi.clear(characterId);
      setMessages([]);
    } catch (e: any) {
      alert('清除失败：' + e.message);
    }
  };

  if (!character) {
    return <div className="chat-loading">加载中...</div>;
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div className="chat-header-info">
          <div className="chat-header-avatar">{character.avatar}</div>
          <div>
            <div className="chat-header-name">{character.name}</div>
            <div className="chat-header-desc">{character.description}</div>
          </div>
        </div>
        <div className="chat-header-actions">
          <select
            value={model}
            onChange={e => setModel(e.target.value as LLMProvider)}
            className="model-select"
          >
            <option value="kimi">🤖 Kimi</option>
            <option value="deepseek">🧠 DeepSeek</option>
            <option value="minimax">✨ MiniMax</option>
          </select>
          <button
            className="header-btn"
            onClick={() => navigate(`/character/${characterId}/extras`)}
            title="补充资料管理"
          >
            📋
          </button>
          <button className="header-btn" onClick={handleSummarize} title="生成今日记忆">
            📝
          </button>
          <button className="header-btn" onClick={handleClear} title="清除聊天记录">
            🗑️
          </button>
        </div>
      </header>

      {latestMemory && (
        <div className="memory-banner" onClick={() => alert(latestMemory.summary)}>
          📔 最新记忆 · {latestMemory.memory_date} · 点击查看
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-avatar">{character.avatar}</div>
            <div className="empty-name">{character.name}</div>
            <div className="empty-greeting">{character.greeting}</div>
            <div className="empty-hint">开始聊天吧～</div>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble
              key={m.id}
              content={m.content}
              senderName={m.sender_name || ''}
              senderAvatar={character.avatar}
              isUser={m.sender_type === 'user'}
              senderType={m.sender_type}
            />
          ))
        )}
        {loading && (
          <div className="message-row character">
            <div className="message-avatar">{character.avatar}</div>
            <div className="message-bubble-wrapper">
              <div className="message-sender">{character.name}</div>
              <div className="message-bubble character">
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="说点什么..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={send}
          disabled={!input.trim() || loading}
        >
          发送
        </button>
      </div>
    </div>
  );
}
