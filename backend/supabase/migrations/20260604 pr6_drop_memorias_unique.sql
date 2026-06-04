-- PR6: 允许 memories 同一天有多条
-- 去掉唯一约束,普通 index 保留(查询用)

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memorias_user_char_date_unique;
