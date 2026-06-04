-- PR6: 允许 memories 同一天有多条
-- 去掉唯一约束,普通 index 保留(查询用)
--
-- 历史:PR4 加的约束叫 `memories_user_char_date_unique` (memories 是英文复数),
--      之前的 PR6 误写为 `memorias_user_char_date_unique` (memorias 是西语),
--      DROP IF EXISTS 是静默 no-op,所以唯一约束一直没被去掉 —— 这是用户
--      "同一天新记忆覆盖旧的" 的根因。修正约束名。

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_user_char_date_unique;
-- 兼容老的环境(万一有人之前手动建过西语名)
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memorias_user_char_date_unique;

-- 顺手 reload PostgREST schema cache,让 PR5 新加的 is_starred / starred_at
-- 在 select * 路径下立即可见
NOTIFY pgrst, 'reload schema';
