import { getSupabaseAdmin, getSupabaseClient } from '../config/supabase';

const LEGACY_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function signupUser(email: string, password: string, displayName: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error('注册失败: ' + error.message);
  const user = data.user!;

  // 触发器会自动建 user_profiles 行,这里再 upsert 一次以确保 display_name 设置正确
  await supabase.from('user_profiles').upsert({
    user_id: user.id, display_name: displayName,
  });

  // 立即签发 token(让用户不用去收件箱点验证)
  const { data: signInData, error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (signInError) throw new Error('注册后登录失败: ' + signInError.message);
  const session = signInData.session!;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: { id: user.id, email: user.email, displayName },
  };
}

export async function loginUser(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('登录失败: ' + error.message);
  return {
    accessToken: data.session!.access_token,
    refreshToken: data.session!.refresh_token,
    user: { id: data.user!.id, email: data.user!.email },
  };
}

export async function refreshSession(refreshToken: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new Error('刷新失败: ' + error.message);
  return {
    accessToken: data.session!.access_token,
    refreshToken: data.session!.refresh_token,
  };
}

export async function logoutUser(_accessToken: string) {
  // supabase-js 没有"撤销单个 token"的标准 API;客户端清 localStorage 即可
  return;
}

export async function getProfile(accessToken: string) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData.user) throw new Error('token 无效');
  const { data: profile, error: profErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userData.user.id)
    .single();
  if (profErr) throw new Error('读取 profile 失败: ' + profErr.message);
  return profile;
}

export async function claimLegacy(targetUserId: string) {
  const supabase = getSupabaseAdmin();

  // 把所有 user_id = LEGACY_USER_ID 的数据(除预设外)转移给目标用户
  const tables = ['characters', 'character_extras', 'groups', 'messages', 'memories'];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .update({ user_id: targetUserId })
      .eq('user_id', LEGACY_USER_ID);
    if (error) throw new Error(`迁移 ${t} 失败: ${error.message}`);
  }

  // group_members 跟随 group
  const { error: gmErr } = await supabase
    .from('group_members')
    .update({ user_id: targetUserId })
    .eq('user_id', LEGACY_USER_ID);
  if (gmErr) throw new Error('迁移 group_members 失败: ' + gmErr.message);

  // 删 legacy profile
  await supabase.from('user_profiles').delete().eq('user_id', LEGACY_USER_ID);

  // 删 legacy auth user
  const { error: delErr } = await supabase.auth.admin.deleteUser(LEGACY_USER_ID);
  if (delErr) throw new Error('删除 legacy auth user 失败: ' + delErr.message);

  return { success: true };
}
