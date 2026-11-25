'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CloseIcon } from './icons';

export interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Highlight as the main action. */
  primary?: boolean;
}

interface ToastOptions {
  actions?: ToastAction[];
  /** Milliseconds before it goes away. */
  duration?: number;
}

interface ToastState {
  show: (message: ReactNode, options?: ToastOptions) => void;
  dismiss: () => void;
}

interface Current extends ToastOptions {
  id: number;
  message: ReactNode;
}

const ToastContext = createContext<ToastState | null>(null);

/** One message at a time, announced to screen readers, with optional action buttons. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback<ToastState['show']>(
    (message, options = {}) => {
      clearTimeout(timer.current);
      const id = ++nextId.current;
      setCurrent({ id, message, ...options });
      timer.current = setTimeout(() => setCurrent((c) => (c?.id === id ? null : c)), options.duration ?? 5000);
    },
    [],
  );

  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  const action = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition';
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-3 top-[5.5rem] z-50 flex justify-center sm:inset-x-auto sm:right-4 sm:justify-end">
        {current && (
          <div data-testid="toast" className="pointer-events-auto w-full max-w-sm rounded-xl bg-ink p-4 text-white shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{current.message}</p>
              <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white">
                <CloseIcon width={16} height={16} />
              </button>
            </div>
            {current.actions && current.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {current.actions.map((a) => {
                  const cls = `${action} ${a.primary ? 'bg-brand text-ink hover:bg-white' : 'border border-white/40 text-white hover:bg-white/10'}`;
                  return a.href ? (
                    <Link key={a.label} href={a.href} onClick={dismiss} className={cls}>{a.label}</Link>
                  ) : (
                    <button key={a.label} type="button" onClick={() => { a.onClick?.(); dismiss(); }} className={cls}>{a.label}</button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
