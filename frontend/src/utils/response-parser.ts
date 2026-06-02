// 解析 AI 回复格式
// 格式：
// [场景描述]（可选）
// AI 自己的对话（动作/心理）
// AI 自己的对话（动作/心理）
//
// 双引号只在场景描述中引用别人话时使用

import type { ParsedSegment } from './types';

export type { ParsedSegment };

export function parseResponse(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  if (!text) return segments;

  // 匹配场景 [...]
  const sceneRegex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = sceneRegex.exec(text)) !== null) {
    // 场景前的对话
    if (match.index > lastIndex) {
      const dialogues = text.slice(lastIndex, match.index).trim().split('\n').filter(Boolean);
      dialogues.forEach(line => {
        const seg = parseDialogueLine(line);
        if (seg) segments.push(seg);
      });
    }

    // 场景描述
    segments.push({ type: 'scene', content: match[1] });
    lastIndex = sceneRegex.lastIndex;
  }

  // 最后的对话
  if (lastIndex < text.length) {
    const dialogues = text.slice(lastIndex).trim().split('\n').filter(Boolean);
    dialogues.forEach(line => {
      const seg = parseDialogueLine(line);
      if (seg) segments.push(seg);
    });
  }

  return segments;
}

function parseDialogueLine(line: string): ParsedSegment | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 匹配 "对话"（动作） 格式
  const actionMatch = trimmed.match(/^(.+?)(（.+）)\s*$/);
  if (actionMatch) {
    return {
      type: 'dialogue',
      content: actionMatch[1].trim(),
      action: actionMatch[2],
    };
  }

  // 普通对话
  return { type: 'dialogue', content: trimmed };
}
