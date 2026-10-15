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
        className="rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
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
