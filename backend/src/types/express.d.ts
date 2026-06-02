// Express Request 类型扩展 — 让 requireAuth / optionalAuth 设置的 req.user 有类型
// 在 tsconfig 的 include 范围里(src/**)自动加载

import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
