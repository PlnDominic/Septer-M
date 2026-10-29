export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Septer-M. Delivering to the UK and Ghana.</p>
        <p>Patch test before first use. Discontinue if irritation occurs.</p>
      </div>
    </footer>
  );
}
