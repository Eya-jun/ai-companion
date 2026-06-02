-- PR2: 给业务表加 user_id 字段 + 索引
-- 注意:messages 和 memories 留给 PR3(plan 安排)

-- characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
-- 预设角色保持 user_id=NULL,自定义角色绑定到用户
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

-- character_extras
ALTER TABLE character_extras ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_extras_user ON character_extras(user_id);

-- groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id);

-- group_members(透传所属 group 的 user_id)
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
