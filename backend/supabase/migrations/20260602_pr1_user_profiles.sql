-- PR1: 加 user_profiles
-- 用途:每个注册用户一张卡,存头像/称呼/性别/年龄/身份/MBTI/自我介绍

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_name TEXT,
  gender TEXT,
  age INT,
  occupation TEXT,
  mbti TEXT,
  bio TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 触发器:auth.users 新建时自动建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS:用户只能看/改自己的 profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 允许 service_role 全部访问(后端 service key)
CREATE POLICY "Service role full access on user_profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');
