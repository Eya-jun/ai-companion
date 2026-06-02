-- PR4: 给 memories 表加 UNIQUE 约束(支持 upsert)
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_user_char_date_unique;
ALTER TABLE memories ADD CONSTRAINT memories_user_char_date_unique UNIQUE (user_id, character_id, memory_date);
