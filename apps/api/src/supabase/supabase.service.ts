import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';

/**
 * Service-role client: bypasses Row Level Security, so every route that uses it
 * must do its own authorisation (see AuthGuard / RolesGuard).
 */
@Injectable()
export class SupabaseService {
  private client?: SupabaseClient;

  get admin(): SupabaseClient {
    if (!this.client) {
      const env = getEnv();
      this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
  }
}
