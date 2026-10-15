'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ALL_BRANDS, BRAND_COOKIE } from '@/lib/db/repo/brand-cookie';

export function BrandSwitcher({ brands, selected }: { brands: { id: string; name: string; color: string }[]; selected: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Marca</span>
      <select
        aria-label="Marca"
        className="max-w-44 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white disabled:opacity-60 [&>option]:text-foreground"
        value={selected ?? ALL_BRANDS}
        disabled={pending}
        onChange={(e) => {
          document.cookie = `${BRAND_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          start(() => router.refresh());
        }}
      >
        <option value={ALL_BRANDS}>Todas as marcas</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
