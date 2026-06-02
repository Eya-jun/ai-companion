// Express Request 类型扩展 — 让 requireAuth / optionalAuth 设置的 req.user 有类型
// 因为 ts-node 对 .d.ts 自动加载有兼容问题,这里用普通 .ts 文件 + 全局声明
// 用到 req.user 的文件需要 import 这个文件

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
