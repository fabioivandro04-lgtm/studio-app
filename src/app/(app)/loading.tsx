/** Esboço mostrado logo ao tocar no menu, enquanto a página carrega. */
export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-3xl space-y-4">
      <span className="sr-only" role="status">A carregar…</span>
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
