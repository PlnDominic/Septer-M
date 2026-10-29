import type { Product } from '@/lib/products';

/** Placeholder bottle graphic until real product photography is available. */
export function ProductVisual({ product, className = '', square = false }: { product: Product; className?: string; square?: boolean }) {
  return (
    <div
      className={`relative flex ${square ? 'aspect-square' : 'aspect-[4/5]'} items-center justify-center overflow-hidden rounded-2xl ${className}`}
      style={{ background: `linear-gradient(160deg, ${product.tint[0]}, ${product.tint[1]})` }}
      role="img"
      aria-label={`${product.name} (illustration)`}
    >
      <div className="flex h-2/3 w-1/3 flex-col items-center">
        <div className="h-[10%] w-1/2 rounded-t-md bg-ink/70" />
        <div className="flex w-full flex-1 items-center justify-center rounded-2xl bg-white/80 shadow-md">
          <span className="rotate-0 px-1 text-center font-serif text-[10px] leading-tight tracking-widest text-ink/70 uppercase">
            Septer-M
          </span>
        </div>
      </div>
    </div>
  );
}
