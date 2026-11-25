/** Turns Supabase Auth errors into messages a shopper can act on. */
export function friendlyAuthError(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid_credentials')) return 'That email and password don’t match. Check them and try again.';
  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) return 'Please confirm your email first. We sent you a link when you signed up.';
  if (text.includes('already registered') || text.includes('user_already_exists')) return 'An account with that email already exists. Try signing in instead.';
  if (text.includes('weak_password') || text.includes('password should be')) return 'Choose a stronger password (at least 8 characters).';
  if (text.includes('rate limit') || text.includes('over_email_send_rate_limit') || error?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (text.includes('same_password')) return 'Your new password must be different from the old one.';
  if (text.includes('failed to fetch') || text.includes('network')) return 'We couldn’t reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
