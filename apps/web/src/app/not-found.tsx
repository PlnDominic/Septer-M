import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <Link href="/shop" className="mt-6 inline-block underline">Back to the shop</Link>
    </div>
  );
}
