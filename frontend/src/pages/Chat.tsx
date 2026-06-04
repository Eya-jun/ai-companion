import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  charactersApi,
  chatApi,
  memoriesApi,
  affinityApi,
  sendStream,
} from '../api/client';
import type { Character, Message, LLMProvider, AffinityState } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import ChatBubble from '../components/velin/ChatBubble';
import ChatInput from '../components/velin/ChatInput';
import Avatar from '../components/velin/Avatar';
import { themeFor } from '../theme/characterThemes';
import styles from './Chat.module.css';

export default function Chat() {
  const { characterId = '' } = useParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [model] = useState<LLMProvider>('deepseek');
  const [, setAffinity] = useState<AffinityState | null>(null);
  const [, setLatestMemory] = useState<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // === LOAD ===
  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    const loadAll = async () => {
      if (!characterId) return;
      try {
        const [char, msgs, mem, aff] = await Promise.all([
          charactersApi.get(characterId),
          chatApi.getMessages(characterId),
          memoriesApi.latest(characterId).catch(() => ({ data: null })),
          affinityApi.get(characterId).catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setCharacter(char.data);
        // 防御性排序:无论 API 返回什么顺序,按 created_at 升序
        const sorted = [...(msgs.data || [])].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(sorted);
        setLatestMemory(mem.data);
        if (aff.data) setAffinity(aff.data);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[Chat] loadAll failed:', e);
        alert('加载失败：' + e.message);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [characterId]);

  // === SCROLL TO BOTTOM ON NEW MESSAGES ===
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!characterId || !character || sending) return;
    const userText = text.trim();
    if (!userText) {
      alert('消息不能为空');
      return;
    }
    setSending(true);

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
      sender_name: character.name,
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
        // done / meta / error 都不需要额外动作
      });
      // 不 reload:流式完成时保持乐观状态。
    } catch (e: any) {
      // 流失败时,移除空 AI 消息并提示
      setMessages(prev => prev.filter(m => m.id !== aiMsgId));
      alert('发送失败：' + e.message);
    } finally {
      setSending(false);
    }
  };

  if (!character) {
    return (
      <AppShell showTabBar={false}>
        <div className={styles.page}>
          <div className={styles.body} />
        </div>
      </AppShell>
    );
  }

  const theme = themeFor(character.name) as 'a' | 'b' | 'c' | 'd';
  const userFirstChar = character.name.charAt(0);

  return (
    <AppShell showTabBar={false} blobTheme={theme}>
      <div className={styles.page}>
        <ChatHeader
          title={character.name}
          subtitle="在线 · 刚刚"
          live
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
            const isMe = m.role === 'user';
            const prev = messages[i - 1];
            const showMeta =
              !prev ||
              prev.role !== m.role ||
              new Date(m.created_at).getTime() -
                new Date(prev.created_at).getTime() >
                60_000;
            return (
              <ChatBubble
                key={m.id || i}
                sender={isMe ? 'me' : 'them'}
                theme={isMe ? 'a' : theme}
                avatar={
                  isMe ? (
                    <Avatar theme="user" label="我" size="sm" />
                  ) : (
                    <Avatar theme={theme} label={userFirstChar} imageUrl={character.avatar} size="sm" />
                  )
                }
                stamp={
                  showMeta
                    ? new Date(m.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : undefined
                }
              >
                {m.content}
              </ChatBubble>
            );
          })}
        </div>
        <div className={styles['input-zone']}>
          <ChatInput onSend={send} />
        </div>
      </div>
    </AppShell>
  );
}
