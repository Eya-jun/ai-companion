import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * 内部 token 鉴权中间件。
 * - 当 config.internalToken 为空(未设置 INTERNAL_TOKEN 环境变量)时,中间件直接放行,
 *   行为与之前完全一致,本地开发零侵入。
 * - 当 config.internalToken 非空时,所有走 /api/* 的请求必须带
 *   `X-Internal-Token: <token>` 头,值不匹配直接返回 401。
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