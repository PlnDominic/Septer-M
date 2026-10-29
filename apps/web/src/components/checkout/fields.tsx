import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const control = (error?: string) =>
  `h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-ink ${error ? 'border-red-600' : 'border-line'}`;

function Wrap({ id, label, error, hint, optional, children }: { id: string; label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string; optional?: boolean };

export function TextField({ id, label, error, hint, optional, className = '', ...rest }: InputProps) {
  return (
    <Wrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
        className={`${control(error)} ${className}`}
      />
    </Wrap>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string; children: ReactNode };

export function SelectField({ id, label, error, children, className = '', ...rest }: SelectProps) {
  return (
    <Wrap id={id} label={label} error={error}>
      <select id={id} name={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...rest} className={`${control(error)} ${className}`}>
        {children}
      </select>
    </Wrap>
  );
}

export function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-lg">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Choice({ name, checked, onChange, title, detail, aside }: { name: string; checked: boolean; onChange: () => void; title: string; detail?: string; aside?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${checked ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-brand'}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[#ff5500]" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
      {aside && <span className="text-sm font-medium">{aside}</span>}
    </label>
  );
}
