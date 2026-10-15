export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <main className="prose mx-auto max-w-2xl px-4 py-10 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:font-semibold [&_p]:mt-3">{children}</main>;
}
