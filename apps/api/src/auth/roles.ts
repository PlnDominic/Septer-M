import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@septer-m/shared';
import { AuthGuard, type AuthedRequest, type AuthUser } from './auth.guard';

const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to this.' });
    return true;
  }
}

/** Sign-in required, and the user must have the admin role. */
export const AdminOnly = () => applyDecorators(SetMetadata(ROLES_KEY, ['admin']), UseGuards(AuthGuard, RolesGuard));

/** Sign-in required (any role). */
export const SignedIn = () => applyDecorators(UseGuards(AuthGuard));

/** The authenticated user (undefined for guests on optional-auth routes). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
  ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
