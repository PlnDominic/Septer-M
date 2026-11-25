'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@septer-m/shared';
import { friendlyAuthError } from '@/lib/auth-errors';
import { getSupabase } from '@/lib/supabase/client';

interface Profile {
  role: UserRole;
  fullName: string | null;
}

/** `error` is a ready-to-show message, or null on success. */
type Outcome = { error: string | null };

interface AuthState {
  /** False when the Supabase env vars are missing. */
  configured: boolean;
  /** True until the stored session has been read. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True after following a password-reset link, until the new password is saved. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<Outcome>;
  /** `needsConfirmation` is true when Supabase wants the email confirmed before signing in. */
  signUp: (email: string, password: string, fullName: string) => Promise<Outcome & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<Outcome>;
  updatePassword: (password: string) => Promise<Outcome>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [loading, setLoading] = useState(!!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Only set state in here; awaiting Supabase calls inside this callback can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile({ role: (data?.role as UserRole | undefined) ?? 'customer', fullName: data?.full_name ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const signIn = useCallback<AuthState['signIn']>(
    async (email, password) => {
      if (!supabase) return { error: 'Sign-in is not set up yet.' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? friendlyAuthError(error) : null };
    },
    [supabase],
  );

  const signUp = useCallback<AuthState['signUp']>(
    async (email, password, fullName) => {
      if (!supabase) return { error: 'Sign-up is not set up yet.', needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() || undefined }, emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) return { error: friendlyAuthError(error), needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  const requestReset = useCallback<AuthState['requestReset']>(
    async (email) => {
      if (!supabase) return { error: 'Password reset is not set up yet.' };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/account/reset` });
      // Never reveal whether an account exists; only surface real delivery problems.
      return { error: error && (error.status === 429 || /rate limit/i.test(error.message)) ? friendlyAuthError(error) : null };
    },
    [supabase],
  );

  const updatePassword = useCallback<AuthState['updatePassword']>(
    async (password) => {
      if (!supabase) return { error: 'Password reset is not set up yet.' };
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) setRecovering(false);
      return { error: error ? friendlyAuthError(error) : null };
    },
    [supabase],
  );

  const value = useMemo<AuthState>(
    () => ({ configured: !!supabase, loading, session, user: session?.user ?? null, profile, recovering, signIn, signUp, signOut, requestReset, updatePassword }),
    [supabase, loading, session, profile, recovering, signIn, signUp, signOut, requestReset, updatePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
