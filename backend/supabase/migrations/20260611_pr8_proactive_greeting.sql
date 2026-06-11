-- PR8: AI 主动问候功能 — 记录主动发送的消息用于 rate limiting

CREATE TABLE IF NOT EXISTS proactive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  content_preview TEXT,
  affinity_at_send INT
);

-- 按天查某角色的发送次数
CREATE INDEX IF NOT EXISTS proactive_log_user_char_date_idx
  ON proactive_log (user_id, character_id, sent_at DESC);

-- reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
