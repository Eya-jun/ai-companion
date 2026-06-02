import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, chatApi, memoriesApi, affinityApi, sendStream } from '../api/client';
import type { Character, Message, LLMProvider, AffinityState } from '../api/types';
import MessageBubble from '../components/MessageBubble';
import AffinityMeter from '../components/AffinityMeter';
import IntimateModeToggle from '../components/IntimateModeToggle';
import UnlockCelebration from '../components/UnlockCelebration';
import './Chat.css';

export default function Chat() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<LLMProvider>('kimi');
  const [affinity, setAffinity] = useState<AffinityState | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
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
      const [char, msgs, mem, aff] = await Promise.all([
        charactersApi.get(characterId),
        chatApi.getMessages(characterId),
        memoriesApi.latest(characterId).catch(() => ({ data: null })),
        affinityApi.get(characterId).catch(() => ({ data: null })),
      ]);
      setCharacter(char.data);
      setMessages(msgs.data);
      setLatestMemory(mem.data);
      if (aff.data) setAffinity(aff.data);
    } catch (e: any) {
      alert('加载失败：' + e.message);
    }
  };

  // 首次达到 100% → 弹庆祝(localStorage 标记本设备只弹一次)
  useEffect(() => {
    if (!affinity?.unlockedAt || !characterId) return;
    const seenKey = `seen_celebration_for_${characterId}`;
    if (!localStorage.getItem(seenKey)) {
      setShowCelebration(true);
      localStorage.setItem(seenKey, 'true');
    }
  }, [affinity?.unlockedAt, characterId]);

  const send = async () => {
    if (!input.trim() || !characterId || loading) return;
    const userText = input.trim();
    setInput('');
    setLoading(true);

    // 乐观插入用户消息
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

    // 插入一个空的 AI 消息,流式填充 content
    const aiMsgId = 'temp-ai-' + Date.now();
    const aiMsg: Message = {
      id: aiMsgId,
      character_id: characterId,
      role: 'assistant',
      content: '',
      sender_type: 'character',
      sender_name: character?.name || 'AI',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMsg]);

    try {
      await sendStream(characterId, userText, model, (evt) => {
        if ('delta' in evt) {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: m.content + evt.delta } : m
          ));
        }
        // done / meta / error 都不需要额外动作(meta 已由我们 set 了空消息)
      });
      // 流式完成后,从服务端 reload 一次,拿到真实 id(替代 temp id)
      const msgs = await chatApi.getMessages(characterId);
      setMessages(msgs.data);
    } catch (e: any) {
      // 流失败时,移除空 AI 消息并提示
      setMessages(prev => prev.filter(m => m.id !== aiMsgId));
      alert('发送失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // (handleSummarize 已删,记忆管理入口在 Memories 页)

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
            {affinity && (
              <div style={{ marginTop: 4 }}>
                <AffinityMeter affinity={affinity.affinity} stage={affinity.stage} variant="header" />
              </div>
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          {affinity?.unlockedAt && (
            <IntimateModeToggle
              characterId={characterId!}
              mode={affinity.mode}
              onChange={m => setAffinity(s => s ? { ...s, mode: m } : s)}
            />
          )}
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
          <button className="header-btn" onClick={() => navigate(`/character/${characterId}/memories`)} title="记忆管理">
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

      {showCelebration && character && (
        <UnlockCelebration
          characterId={characterId!}
          characterName={character.name}
          characterAvatar={character.avatar}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
