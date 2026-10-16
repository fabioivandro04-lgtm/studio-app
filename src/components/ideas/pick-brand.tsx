'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setBrandCookie } from '@/components/brand-switcher';
import { Button } from '@/components/ui/button';

/** Em "Todas as marcas": escolher a marca ali mesmo para gerar ideias. */
export function PickBrand({ brands }: { brands: { id: string; name: string; color: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section aria-label="Escolher marca" className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-sm">Para gerar ideias, escolha a marca:</p>
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <Button key={b.id} type="button" variant="outline" disabled={pending} onClick={() => { setBrandCookie(b.id); start(() => router.refresh()); }}>
            <span className="size-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
            {b.name}
          </Button>
        ))}
      </div>
    </section>
  );
}
