'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const SETUP_COOKIE = 'setup_dismissed';

function dismiss() {
  document.cookie = `${SETUP_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

/** Linha "Falta 1 passo" com botão para fechar (lembrado num cookie). */
export function SetupCompact({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <section aria-label="Primeiros passos" className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
      <span className="size-2 shrink-0 rounded-full bg-brand-amber" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        Falta 1 passo: <span className="font-medium">{label.charAt(0).toLowerCase() + label.slice(1)}</span>
      </p>
      <Link href={href} className="shrink-0 font-medium text-primary hover:underline">Continuar</Link>
      <button
        type="button"
        aria-label="Fechar"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        onClick={() => {
          dismiss();
          router.refresh();
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  );
}
