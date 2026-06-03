import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupsApi } from '../api/client';
import type { Group, Message, LLMProvider } from '../api/types';
import MessageBubble from '../components/MessageBubble';
import './Chat.css';

export default function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [model, setModel] = useState<LLMProvider>('deepseek');
  const [triggerAll, setTriggerAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId) return;
    loadAll();
    const interval = setInterval(loadAll, 5000); // 5秒刷新
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAll = async () => {
    if (!groupId) return;
    try {
      const [g, msgs] = await Promise.all([
        groupsApi.get(groupId),
        groupsApi.getMessages(groupId),
      ]);
      setGroup(g.data);
      setMessages(msgs.data);
    } catch (e: any) {
      console.error('加载失败：', e);
    }
  };

  const send = async () => {
    if (!input.trim() || !groupId || loading) return;
    const userText = input.trim();
    setInput('');
    setLoading(true);

    const tempUserMsg: Message = {
      id: 'temp-' + Date.now(),
      group_id: groupId,
      role: 'user',
      content: userText,
      sender_type: 'user',
      sender_name: '我',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await groupsApi.sendMessage(groupId, userText, model, triggerAll);
      // 移除临时用户消息
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        // 添加真实用户消息和AI回复
        return [
          ...filtered,
          res.data.userMessage,
          ...res.data.responses,
        ];
      });
    } catch (e: any) {
      alert('发送失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerInteraction = async () => {
    if (!groupId || triggering) return;
    setTriggering(true);
    try {
      const res = await groupsApi.triggerInteraction(groupId, model, 2);
      setMessages(prev => [...prev, ...res.data]);
    } catch (e: any) {
      alert('触发失败：' + e.message);
    } finally {
      setTriggering(false);
    }
  };

  if (!group) {
    return <div className="chat-loading">加载中...</div>;
  }

  const characterById = (id?: string) => {
    return group.members?.find(m => m.character_id === id)?.characters;
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <div className="chat-header-info">
          <div className="chat-header-avatar">👥</div>
          <div>
            <div className="chat-header-name">{group.name}</div>
            <div className="chat-header-desc">
              {group.members?.length || 0} 个成员
            </div>
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
            onClick={triggerInteraction}
            disabled={triggering || !group.members || group.members.length < 2}
            title="触发角色互动"
          >
            {triggering ? '⏳' : '💫'}
          </button>
        </div>
      </header>

      {group.members && group.members.length > 0 && (
        <div className="group-members">
          {group.members.map(m => (
            <div key={m.character_id} className="member-chip">
              <span>{m.characters.avatar}</span>
              <span>{m.characters.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-avatar">👥</div>
            <div className="empty-name">{group.name}</div>
            <div className="empty-hint">说点什么，或者点击 💫 触发角色互动</div>
          </div>
        ) : (
          messages.map(m => {
            const char = characterById(m.sender_id);
            return (
              <MessageBubble
                key={m.id}
                content={m.content}
                senderName={m.sender_name || ''}
                senderAvatar={char?.avatar}
                isUser={m.sender_type === 'user'}
                senderType={m.sender_type}
              />
            );
          })
        )}
        {(loading || triggering) && (
          <div className="message-row character">
            <div className="message-avatar">💭</div>
            <div className="message-bubble-wrapper">
              <div className="message-sender">思考中</div>
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
        <label className="trigger-all-toggle">
          <input
            type="checkbox"
            checked={triggerAll}
            onChange={e => setTriggerAll(e.target.checked)}
          />
          <span>让所有角色都回复</span>
        </label>
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
