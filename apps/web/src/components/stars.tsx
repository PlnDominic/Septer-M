export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" aria-label={`Rated ${value} out of 5`}>
      <span className="relative inline-block leading-none tracking-tight" aria-hidden>
        <span className="text-line">★★★★★</span>
        <span className="absolute inset-0 overflow-hidden text-brand" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span>
      </span>
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}
