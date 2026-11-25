import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fakeSupabase } from '../fake-supabase.testing';
import type { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard, OptionalAuthGuard } from './auth.guard';
import { AdminOnly, RolesGuard } from './roles';

const ctx = (req: Record<string, unknown>, handler: object = () => undefined): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => class {} }) as unknown as ExecutionContext;

const users = { 'good-token': { id: 'u1', email: 'a@b.c' } };
const make = (role: 'customer' | 'admin' = 'customer') => fakeSupabase({ users, role }).service as unknown as SupabaseService;

describe('AuthGuard', () => {
  it('rejects requests without a token', async () => {
    await expect(new AuthGuard(make()).canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    await expect(new AuthGuard(make()).canActivate(ctx({ headers: { authorization: 'Bearer nope' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the user and the role from the database', async () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good-token' } };
    await expect(new AuthGuard(make('admin')).canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.c', role: 'admin' });
  });

  it('ignores any role the client tries to send', async () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good-token', 'x-role': 'admin' }, body: { role: 'admin' } };
    await new AuthGuard(make('customer')).canActivate(ctx(req));
    expect((req.user as { role: string }).role).toBe('customer');
  });

  it('optional guard lets guests through but still rejects a bad token', async () => {
    const guard = new OptionalAuthGuard(make());
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ headers: { authorization: 'Bearer nope' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  @AdminOnly()
  class Protected {}
  const guard = new RolesGuard(new Reflector());
  const run = (role?: 'customer' | 'admin') => guard.canActivate(ctx({ user: role ? { id: 'u', role } : undefined }, Protected));

  it('allows admins', () => expect(run('admin')).toBe(true));
  it('forbids customers', () => expect(() => run('customer')).toThrow(ForbiddenException));
  it('forbids anonymous requests', () => expect(() => run()).toThrow(ForbiddenException));
});
