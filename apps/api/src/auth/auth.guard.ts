import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@septer-m/shared';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: UserRole;
}

export type AuthedRequest = FastifyRequest & { user?: AuthUser };

const bearer = (req: FastifyRequest): string | undefined => {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
};

/**
 * Verifies the Supabase access token and attaches { id, email, role } to the request.
 * The token is checked with Supabase Auth (so revoked sessions stop working); the role
 * always comes from the profiles table, never from anything the client sends.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /** When false, requests without a token pass as guests (a bad token is still rejected). */
  protected readonly required: boolean = true;

  constructor(protected readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearer(req);
    if (!token) {
      if (this.required) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
      return true;
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Your session has expired. Sign in again.' });

    const profile = await this.supabase.admin.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    req.user = { id: data.user.id, email: data.user.email, role: (profile.data?.role as UserRole | undefined) ?? 'customer' };
    return true;
  }
}

@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  protected override readonly required = false;
}
