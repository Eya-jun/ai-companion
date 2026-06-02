// 按 spec §6.1 拼 system_prompt
// 6 个块:character SP → extras → user info → stage → intimate → recent reasons

export interface ExtraForPrompt {
  type: 'note' | 'story' | 'relationship' | 'memory_hint';
  title: string;
  content: string;
}

export interface AssemblyInput {
  character: { system_prompt: string; [k: string]: any };
  user: {
    bio: string | null;
    preferred_name: string | null;
    occupation: string | null;
    age: number | null;
    mbti: string | null;
  };
  stage: { stage: string; description: string; prompt_snippet: string };
  mode: 'daily' | 'intimate';
  affinity: number;
  extras: ExtraForPrompt[];
  recentReasons: { date: string; reason: string }[];
}

const INTIMATE_DESCRIPTOR = '现在你们的关系允许更亲密的互动:可以主动用昵称、表达想念、有更多肢体接触描写、偶尔撒娇/吃醋。';

export function assemblePrivateChatSystemPrompt(input: AssemblyInput): string {
  const { character, user, stage, mode, affinity, extras, recentReasons } = input;
  const blocks: string[] = [];

  // [1] character SP
  blocks.push(character.system_prompt);

  // [2] extras(分类型分组)
  if (extras.length > 0) {
    const byType: Record<string, ExtraForPrompt[]> = {};
    extras.forEach(e => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });

    const labels: Record<string, string> = {
      note: '【用户补充设定】',
      story: '【你们之间的故事背景】',
      relationship: '【关系进展记录】',
      memory_hint: '【重要记忆提示】',
    };

    const sections: string[] = [];
    for (const [type, items] of Object.entries(byType)) {
      sections.push(`${labels[type]}\n${items.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
    }

    blocks.push(`以下是用户为你添加的额外信息（必须严格遵守）：\n\n${sections.join('\n\n')}`);
  }

  // [3] user info(自然语言拼接)
  const userBits: string[] = [];
  if (user.bio) userBits.push(user.bio);
  if (user.preferred_name) userBits.push(`称呼她为「${user.preferred_name}」。`);
  if (user.occupation) userBits.push(`她的身份是${user.occupation}`);
  if (user.age !== null && user.age !== undefined) userBits.push(`${user.age} 岁`);
  if (user.mbti) userBits.push(`MBTI 是 ${user.mbti}`);
  if (userBits.length > 0) {
    blocks.push(`关于你的用户（以下是事实，作为参考）：\n${userBits.join('，')}。`);
  }

  // [4] stage
  blocks.push(`你们目前的关系：${stage.description}（好感度 ${affinity}%）\n${stage.prompt_snippet}`);

  // [5] intimate descriptor
  if (mode === 'intimate') {
    blocks.push(INTIMATE_DESCRIPTOR);
  }

  // [6] recent reasons
  if (recentReasons.length > 0) {
    blocks.push(`最近的互动印象：\n${recentReasons.map(r => `- ${r.date}: ${r.reason}`).join('\n')}`);
  }

  return blocks.join('\n\n═══════════════════════════════════\n\n');
}
