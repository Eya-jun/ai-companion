import { describe, it, expect } from 'vitest';
import { assemblePrivateChatSystemPrompt } from '../src/services/prompt-assembly';

const character = { name: '林默', system_prompt: '你是林默,ENFP 建筑系大三' };
const user = { preferred_name: '小美', occupation: '大三学生', age: 21, mbti: 'INFP', bio: '喜欢猫' };
const stage = { stage: 'flirtatious', description: '暧昧', prompt_snippet: '你们暧昧中' };

describe('assemblePrivateChatSystemPrompt', () => {
  it('包含 character SP', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).toContain('你是林默');
  });

  it('包含用户称呼', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).toContain('「小美」');
  });

  it('intimate 模式追加亲密 descriptor', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'intimate', affinity: 90, extras: [], recentReasons: [] });
    expect(sp).toContain('亲密的互动');
  });

  it('daily 模式不追加亲密 descriptor', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).not.toContain('亲密的互动');
  });

  it('extras 按类型分组', () => {
    const sp = assemblePrivateChatSystemPrompt({
      character, user, stage, mode: 'daily', affinity: 60,
      extras: [
        { type: 'note', title: '语气', content: '温柔一点' },
        { type: 'story', title: '高中', content: '一起参加过夏令营' },
      ],
      recentReasons: [],
    });
    expect(sp).toContain('【用户补充设定】');
    expect(sp).toContain('温柔一点');
    expect(sp).toContain('【你们之间的故事背景】');
    expect(sp).toContain('夏令营');
  });

  it('recent reasons 出现在尾部', () => {
    const sp = assemblePrivateChatSystemPrompt({
      character, user, stage, mode: 'daily', affinity: 60, extras: [],
      recentReasons: [
        { date: '2026-05-30', reason: '她主动约我吃饭' },
      ],
    });
    expect(sp).toContain('最近的互动印象');
    expect(sp).toContain('2026-05-30: 她主动约我吃饭');
  });
});
