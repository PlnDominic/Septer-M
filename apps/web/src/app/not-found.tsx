import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Link href="/" aria-label="Septer-M home">
        <Image src="/brand/wordmark.png" alt="Septer-M" width={1144} height={236} className="h-8 w-auto" />
      </Link>
      <h1 className="mt-10 text-3xl">Page not found</h1>
      <Link href="/shop" className="mt-6 inline-block underline">Back to the shop</Link>
    </main>
  );
}
