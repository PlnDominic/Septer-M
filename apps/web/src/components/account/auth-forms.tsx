'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { TextField } from '@/components/checkout/fields';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const primary = 'h-11 w-full rounded-lg bg-ink font-medium text-white transition hover:bg-brand hover:text-ink disabled:opacity-50';
const linkBtn = 'text-sm underline underline-offset-2 hover:text-brand-dark';

function PasswordField(props: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextField
        id={props.id}
        label={props.label}
        type={show ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        error={props.error}
        hint={props.hint}
        className="pr-16"
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} className="absolute top-[38px] right-3 text-xs underline">
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

/** Google's multicolour "G", used unmodified as their branding guidelines require. */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const Notice = ({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-mist text-ink'}`}>
    {children}
  </p>
);

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthForms() {
  const { signIn, signUp, requestReset, signInWithGoogle, notice, dismissNotice } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const google = async () => {
    setFormError(null);
    setInfo(null);
    dismissNotice();
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setFormError(error);
      setGoogleBusy(false);
    }
    // On success the browser is leaving for Google, so the button stays disabled.
  };

  const switchMode = (m: Mode) => {
    dismissNotice();
    setMode(m);
    setErrors({});
    setFormError(null);
    setInfo(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfo(null);

    const next: Record<string, string> = {};
    if (!EMAIL.test(email.trim())) next.email = 'Enter a valid email address';
    if (mode !== 'forgot' && password.length < (mode === 'signup' ? MIN_PASSWORD : 1)) {
      next.password = mode === 'signup' ? `Use at least ${MIN_PASSWORD} characters` : 'Enter your password';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setFormError(error); // on success the account page re-renders as signed in
      } else if (mode === 'signup') {
        const { error, needsConfirmation } = await signUp(email, password, name);
        if (error) setFormError(error);
        else if (needsConfirmation) setInfo('Almost there! We’ve sent a confirmation link to your email. Open it to finish creating your account.');
      } else {
        const { error } = await requestReset(email);
        if (error) setFormError(error);
        else setInfo('If an account exists for that email, a reset link is on its way.');
      }
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const tab = (active: boolean) => `flex-1 rounded-lg py-2 text-sm font-medium transition ${active ? 'bg-ink text-white' : 'hover:bg-mist'}`;

  return (
    <div className="mx-auto w-full max-w-md">
      {mode !== 'forgot' && (
        <div role="tablist" aria-label="Account" className="mb-6 flex gap-1 rounded-xl border border-line p-1">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={tab(mode === 'signin')} onClick={() => switchMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={tab(mode === 'signup')} onClick={() => switchMode('signup')}>Create account</button>
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {mode === 'forgot' && <p className="mt-2 text-sm text-muted">Enter your email and we’ll send you a link to choose a new password.</p>}

      {notice && mode !== 'forgot' && <div className="mt-4"><Notice tone="error">{notice}</Notice></div>}

      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={googleBusy || busy}
            className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-line bg-white font-medium transition hover:border-ink disabled:opacity-60"
          >
            <GoogleG />
            {googleBusy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} noValidate className={mode === 'forgot' ? 'mt-6 space-y-4' : 'space-y-4'}>
        {mode === 'signup' && <TextField id="name" label="Name" optional autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        <TextField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        {mode !== 'forgot' && (
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            hint={mode === 'signup' ? `At least ${MIN_PASSWORD} characters.` : undefined}
          />
        )}
        {formError && <Notice tone="error">{formError}</Notice>}
        {info && <Notice tone="info">{info}</Notice>}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-5 flex justify-between">
        {mode === 'signin' && <button type="button" className={linkBtn} onClick={() => switchMode('forgot')}>Forgot your password?</button>}
        {mode === 'forgot' && <button type="button" className={linkBtn} onClick={() => switchMode('signin')}>← Back to sign in</button>}
      </div>
    </div>
  );
}
