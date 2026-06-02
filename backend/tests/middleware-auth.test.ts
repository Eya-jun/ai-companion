import { describe, it, expect, vi } from 'vitest';
import { requireAuth, optionalAuth } from '../src/middleware/auth';

describe('auth middleware', () => {
  it('requireAuth 返回 401 当没有 Authorization 头', () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth 返回 401 当 header 不是 Bearer 开头', () => {
    const req = { header: vi.fn().mockReturnValue('Basic xxx') } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('optionalAuth 调用 next 当没有 token', () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as any;
    const res = {} as any;
    const next = vi.fn();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
