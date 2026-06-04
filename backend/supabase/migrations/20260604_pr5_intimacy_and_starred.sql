-- PR5: 亲密度 + 记忆星标
-- 全部 nullable 加列/默认值,避开与存量 NULL 冲突

-- 1) user_character_state 加 intimacy 列(0-100,类似 affinity)
ALTER TABLE user_character_state
  ADD COLUMN IF NOT EXISTS intimacy INT DEFAULT 0 CHECK (intimacy BETWEEN 0 AND 100);

-- 2) memories 加 is_starred(珍藏) + starred_at 时间戳
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

-- 3) is_starred 索引(快速按角色+用户拉珍藏列表)
CREATE INDEX IF NOT EXISTS memories_user_char_starred_idx
  ON memories (user_id, character_id, is_starred)
  WHERE is_starred = true;
