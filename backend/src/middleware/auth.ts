import type { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/supabase';
import { config } from '../config/env';

/**
 * Supabase JWT 鉴权中间件。
 * - 验证 Authorization: Bearer <token>
 * - 用 supabase.auth.getUser(token) 校验 token 是否有效
 * - 成功时把 req.user = { id, email } 挂上
 * - 失败时返回 401
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未授权: 缺少 token' });
  }
  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ success: false, error: '未授权: token 无效' });
    }
    req.user = { id: data.user.id, email: data.user.email ?? '' };
    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: '鉴权失败: ' + err.message });
  }
}

/**
 * 可选鉴权:有 token 就挂 user,没有就放行。
 * 用在 /api/health 这类既能被已登录用户访问、又允许未登录访问的端点。
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  supabase.auth.getUser(token)
    .then(({ data }) => {
      if (data.user) req.user = { id: data.user.id, email: data.user.email ?? '' };
      next();
    })
    .catch(() => next());
}

/**
 * 内部 token 鉴权中间件(双保险,默认关闭)。
 * - 当 config.internalToken 为空(未设置 INTERNAL_TOKEN 环境变量)时,中间件直接放行
 * - 当 config.internalToken 非空时,所有走 /api/* 的请求必须带 X-Internal-Token 头
 */
export function internalTokenAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.internalToken) {
    return next();
  }

  const provided = req.header('X-Internal-Token');
  if (!provided || provided !== config.internalToken) {
    return res.status(401).json({ success: false, error: '未授权: 缺少或错误的内部 token' });
  }

  next();
}
