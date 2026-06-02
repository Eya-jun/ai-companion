-- PR3: 好感度 + 记忆增强
-- 全部用 nullable 加列,避开与存量 NULL 冲突

-- 1) stage_prompts: 4 阶段默认 prompt 模板
CREATE TABLE IF NOT EXISTS stage_prompts (
  stage TEXT PRIMARY KEY,
  min_pct INT NOT NULL,
  max_pct INT NOT NULL,
  description TEXT NOT NULL,
  prompt_snippet TEXT NOT NULL
);

INSERT INTO stage_prompts (stage, min_pct, max_pct, description, prompt_snippet) VALUES
  ('stranger',     0,  19, '陌生', '你与用户刚认识,礼貌、拘谨、不会主动拉近距离。'),
  ('familiar',    20,  49, '熟悉', '你与用户已经很熟了,会主动开玩笑、分享日常、记得她说过的话。'),
  ('flirtatious', 50,  79, '暧昧', '你与用户之间有暧昧情愫。会吃醋、会有肢体接触暗示、会说一些似是而非的话。'),
  ('intimate',    80, 100, '亲密', '你与用户已经确认关系。会直接表达爱意、用昵称、主动亲密、有占有欲但也很宠。')
ON CONFLICT (stage) DO NOTHING;

-- 2) user_character_state: 每用户对每角色的攻略进度
CREATE TABLE IF NOT EXISTS user_character_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  affinity INT DEFAULT 0 CHECK (affinity BETWEEN 0 AND 100),
  current_stage TEXT DEFAULT 'stranger' REFERENCES stage_prompts(stage),
  mode TEXT DEFAULT 'daily' CHECK (mode IN ('daily', 'intimate')),
  unlocked_at TIMESTAMPTZ,
  difficulty TEXT DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  special_greeting TEXT,
  PRIMARY KEY (user_id, character_id)
);

-- 3) affinity_evaluations: 每日评估原始记录
CREATE TABLE IF NOT EXISTS affinity_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  eval_date DATE NOT NULL,
  prev_affinity INT NOT NULL,
  new_affinity INT NOT NULL,
  delta INT NOT NULL,
  reason TEXT,
  memory_summary TEXT,
  error TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, character_id, eval_date)
);

-- 4) messages / memories 加 user_id(PR2 漏了)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5) memories 加亲和度字段
ALTER TABLE memories ADD COLUMN IF NOT EXISTS affinity_delta INT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS affinity_reason TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai';

-- 6) characters 加难度/解锁/特殊问候
ALTER TABLE characters ADD COLUMN IF NOT EXISTS default_difficulty TEXT DEFAULT 'normal';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS special_greeting TEXT;

-- 7) 索引
CREATE INDEX IF NOT EXISTS idx_messages_user_char ON messages(user_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affinity_eval_user_date ON affinity_evaluations(user_id, eval_date DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date DESC);
