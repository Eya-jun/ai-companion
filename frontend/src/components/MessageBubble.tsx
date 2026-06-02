import { useMemo } from 'react';
import { parseResponse } from '../utils/response-parser';

interface MessageBubbleProps {
  content: string;
  senderName: string;
  senderAvatar?: string;
  isUser: boolean;
  senderType?: 'user' | 'character' | 'system';
  bubbleStyle?: 'default' | 'group';
}

function isImage(avatar?: string) {
  return avatar?.startsWith('data:image') || avatar?.startsWith('http');
}

export default function MessageBubble({
  content,
  senderName,
  senderAvatar,
  isUser,
  senderType,
  bubbleStyle = 'default',
}: MessageBubbleProps) {
  const segments = useMemo(() => parseResponse(content), [content]);

  if (senderType === 'system') {
    return (
      <div className="message-system">
        <div className="system-text">{content}</div>
      </div>
    );
  }

  // 用户消息：每行一个气泡
  if (isUser) {
    const lines = segments.filter(s => s.type === 'dialogue');
    if (lines.length === 0) {
      return (
        <div className="message-row user">
          <div className="message-bubble-wrapper">
            <div className="message-bubble user">{content}</div>
          </div>
          <div className="message-avatar user-avatar">我</div>
        </div>
      );
    }
    return (
      <>
        {lines.map((line, i) => (
          <div key={i} className="message-row user">
            <div className="message-bubble-wrapper">
              <div className="message-bubble user">
                <div className="bubble-text">{line.content}</div>
                {line.action && <div className="bubble-action">{line.action}</div>}
              </div>
            </div>
            {i === 0 && <div className="message-avatar user-avatar">我</div>}
          </div>
        ))}
      </>
    );
  }

  // 角色消息：场景描述独立显示，每句话一个气泡
  const scenes = segments.filter(s => s.type === 'scene');
  const lines = segments.filter(s => s.type === 'dialogue');

  return (
    <>
      {/* 场景描述作为独立斜体文字 */}
      {scenes.map((scene, i) => (
        <div key={`scene-${i}`} className="scene-indicator">
          {scene.content}
        </div>
      ))}

      {/* 每句话一个气泡 */}
      {lines.length === 0 && content && (
        <div className="message-row character">
          <div className="message-avatar">
            {isImage(senderAvatar) ? (
              <img src={senderAvatar} alt={senderName} />
            ) : (
              <span style={{ fontSize: '24px' }}>{senderAvatar || senderName?.charAt(0) || '?'}</span>
            )}
          </div>
          <div className="message-bubble-wrapper">
            <div className={`message-bubble ${bubbleStyle === 'group' ? 'group' : 'character'}`}>
              {content}
            </div>
          </div>
        </div>
      )}

      {lines.map((line, i) => (
        <div key={i} className="message-row character">
          {i === 0 && (
            <div className="message-avatar">
              {isImage(senderAvatar) ? (
                <img src={senderAvatar} alt={senderName} />
              ) : (
                <span style={{ fontSize: '24px' }}>{senderAvatar || senderName?.charAt(0) || '?'}</span>
              )}
            </div>
          )}
          {i > 0 && <div className="message-avatar-spacer" />}
          <div className="message-bubble-wrapper">
            {i === 0 && bubbleStyle === 'group' && (
              <div className="message-sender">{senderName}</div>
            )}
            <div className={`message-bubble ${bubbleStyle === 'group' ? 'group' : 'character'}`}>
              <div className="bubble-text">{line.content}</div>
              {line.action && <div className="bubble-action">{line.action}</div>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
