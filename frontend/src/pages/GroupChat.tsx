import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { groupsApi } from '../api/client';
import type { Group, Message, LLMProvider } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import ChatBubble from '../components/velin/ChatBubble';
import ChatInput from '../components/velin/ChatInput';
import Avatar from '../components/velin/Avatar';
import { themeFor } from '../theme/characterThemes';
import styles from './GroupChat.module.css';

export default function GroupChat() {
  const { groupId = '' } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [model, setModel] = useState<LLMProvider>('deepseek');
  const [triggerAll, setTriggerAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // === LOAD ===
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const loadAll = async () => {
      if (!groupId) return;
      try {
        const [g, msgs] = await Promise.all([
          groupsApi.get(groupId),
          groupsApi.getMessages(groupId),
        ]);
        if (cancelled) return;
        setGroup(g.data);
        const sorted = [...(msgs.data || [])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(sorted);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[GroupChat] loadAll failed:', e);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [groupId]);

  // === SCROLL TO BOTTOM ON NEW MESSAGES ===
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!groupId || !group || sending) return;
    const userText = text.trim();
    if (!userText) return;

    setSending(true);

    // 乐观插入用户消息
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
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          res.data.userMessage,
          ...res.data.responses,
        ];
      });
    } catch (e: any) {
      // 失败时移除临时用户消息并提示
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      alert('发送失败：' + e.message);
    } finally {
      setSending(false);
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
    return (
      <AppShell showTabBar={false}>
        <div className={styles.page}>
          <div className={styles.body} />
        </div>
      </AppShell>
    );
  }

  // Members 列表
  const members = group.members?.map(m => m.characters) ?? [];

  // 取前 2 个角色作为 header 头像
  const headerAvatars = members.slice(0, 2).map(m => (
    <Avatar
      key={m.id}
      theme={themeFor(m.name)}
      label={m.name.charAt(0)}
      size="sm"
      style={{ width: 28, height: 28, fontSize: 10, boxShadow: '0 0 0 2px var(--canvas)' }}
    />
  ));

  // 通过 character_id 查角色
  const characterById = (id?: string) => {
    if (!id) return undefined;
    return group.members?.find(m => m.character_id === id)?.characters;
  };

  const triggerDisabled = triggering || !group.members || group.members.length < 2;

  return (
    <AppShell showTabBar={false}>
      <div className={styles.page}>
        <ChatHeader
          title={group.name}
          subtitle={group.description || `${members.length} 位角色`}
          showBack
          avatars={headerAvatars}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={model}
                onChange={e => setModel(e.target.value as LLMProvider)}
                aria-label="选择模型"
                style={{
                  background: 'var(--glass-1)',
                  border: '1px solid var(--hair)',
                  color: 'var(--text)',
                  borderRadius: 10,
                  padding: '4px 6px',
                  fontSize: 12,
                }}
              >
                <option value="kimi">Kimi</option>
                <option value="deepseek">DeepSeek</option>
                <option value="minimax">MiniMax</option>
              </select>
              <button
                onClick={triggerInteraction}
                disabled={triggerDisabled}
                aria-label="触发角色互动"
                title="触发角色互动"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: '1px solid var(--hair)',
                  background: 'var(--glass-1)',
                  color: 'var(--text)',
                  fontSize: 16,
                  cursor: triggerDisabled ? 'not-allowed' : 'pointer',
                  opacity: triggerDisabled ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {triggering ? '⏳' : '💫'}
              </button>
            </div>
          }
        />
        <div className={styles.body} ref={scrollRef}>
          {messages.length > 0 && (
            <div className={styles.meta}>
              {new Date(messages[0].created_at).toLocaleString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
          {messages.map((m, i) => {
            const speaker = characterById(m.sender_id);
            const speakerName = speaker?.name || m.sender_name || '?';
            const isMe = !speaker || m.sender_type === 'user';
            const themeKey = isMe ? 'a' : themeFor(speakerName);
            return (
              <ChatBubble
                key={m.id || i}
                sender={isMe ? 'me' : 'them'}
                theme={isMe ? 'a' : (themeKey as 'a' | 'b' | 'c' | 'd')}
                avatar={
                  isMe ? (
                    <Avatar theme="user" label="我" size="sm" />
                  ) : (
                    <Avatar theme={themeKey} label={speakerName.charAt(0)} size="sm" />
                  )
                }
                stamp={new Date(m.created_at).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              >
                {!isMe && (
                  <div style={{ fontSize: 11, color: 'var(--text-mute)', marginBottom: 2 }}>
                    {speakerName}
                  </div>
                )}
                {m.content}
              </ChatBubble>
            );
          })}
          {messages.length === 0 && (
            <div className={styles.meta}>
              说点什么，或点击 💫 触发角色互动
            </div>
          )}
        </div>
        <div className={styles['input-zone']}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px 0',
              fontSize: 12,
              color: 'var(--text-dim)',
            }}
          >
            <input
              type="checkbox"
              checked={triggerAll}
              onChange={e => setTriggerAll(e.target.checked)}
            />
            <span>让所有角色都回复</span>
          </label>
          <ChatInput onSend={send} />
        </div>
      </div>
    </AppShell>
  );
}
